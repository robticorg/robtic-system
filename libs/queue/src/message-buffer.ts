import IORedis, { type Redis } from "ioredis";
import { redisConnection } from "./connection";

/**
 * The message buffer: where the Gateway counts real messages instead of writing MongoDB for each
 * one. Three hashes collect while the worker isn't flushing:
 *
 *   act:msg:pending   `day|guild|member` → count
 *   act:msg:last      `guild|member`     → last message time (ms)
 *   act:msg:names     `guild|member`     → username
 *
 * A flush **takes** them atomically (one Lua script renames all three under a batch id), so a
 * message arriving mid-flush simply starts the next batch — nothing is lost or counted twice. While
 * a batch is being applied its id sits in `act:msg:inflight`; a crashed flush leaves it there and
 * the next flush resumes the same batch instead of taking a new one (the MongoDB writes are guarded
 * by the batch id, so resuming is safe).
 */

const KEYS = {
    pending: "act:msg:pending",
    last: "act:msg:last",
    names: "act:msg:names",
    inflight: "act:msg:inflight",
    batch: (id: string, part: "counts" | "last" | "names") => `act:msg:batch:${id}:${part}`,
} as const;

let client: Redis | null = null;

/** The process's general-purpose Redis client (BullMQ keeps its own connections). */
export function getRedis(): Redis {
    client ??= new IORedis({ ...redisConnection(), lazyConnect: false, enableOfflineQueue: false } as never);
    return client;
}

export async function closeRedis(): Promise<void> {
    if (client) await client.quit().catch(() => client?.disconnect());
    client = null;
}

/** Counts one real message — one round trip, no MongoDB. */
export async function bufferMessage(field: string, guildId: string, discordId: string, username: string, at: Date): Promise<void> {
    const member = `${guildId}|${discordId}`;
    await getRedis()
        .multi()
        .hincrby(KEYS.pending, field, 1)
        .hset(KEYS.last, member, String(at.getTime()))
        .hset(KEYS.names, member, username)
        .exec()
        .then(result => {
            const failed = result?.find(([err]) => err);
            if (failed) throw failed[0];
        });
}

/**
 * Atomically turns the pending counts into batch `newId` — or returns the batch already in flight
 * (an unfinished flush). `null` when there is nothing to flush.
 */
const TAKE_BATCH = `
local inflight = redis.call('GET', KEYS[4])
if inflight then return inflight end
if redis.call('EXISTS', KEYS[1]) == 0 then return false end
local id = ARGV[1]
redis.call('RENAME', KEYS[1], 'act:msg:batch:' .. id .. ':counts')
if redis.call('EXISTS', KEYS[2]) == 1 then redis.call('RENAME', KEYS[2], 'act:msg:batch:' .. id .. ':last') end
if redis.call('EXISTS', KEYS[3]) == 1 then redis.call('RENAME', KEYS[3], 'act:msg:batch:' .. id .. ':names') end
redis.call('SET', KEYS[4], id)
return id
`;

export async function takeMessageBatch(newId: string): Promise<string | null> {
    const id = await getRedis().eval(TAKE_BATCH, 4, KEYS.pending, KEYS.last, KEYS.names, KEYS.inflight, newId);
    return typeof id === "string" ? id : null;
}

export async function readMessageBatch(id: string): Promise<{ counts: Record<string, string>; last: Record<string, string>; names: Record<string, string> }> {
    const redis = getRedis();
    const [counts, last, names] = await Promise.all([
        redis.hgetall(KEYS.batch(id, "counts")),
        redis.hgetall(KEYS.batch(id, "last")),
        redis.hgetall(KEYS.batch(id, "names")),
    ]);
    return { counts, last, names };
}

/** The batch is fully applied: drop it, and clear `inflight` only if it still names this batch. */
const FINISH_BATCH = `
redis.call('DEL', KEYS[1], KEYS[2], KEYS[3])
if redis.call('GET', KEYS[4]) == ARGV[1] then redis.call('DEL', KEYS[4]) end
return 1
`;

export async function finishMessageBatch(id: string): Promise<void> {
    await getRedis().eval(FINISH_BATCH, 4, KEYS.batch(id, "counts"), KEYS.batch(id, "last"), KEYS.batch(id, "names"), KEYS.inflight, id);
}
