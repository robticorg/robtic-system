import { getRedis } from "./message-buffer";
import { LEADER_KEYS, type LeaderRedis } from "./leader";

/**
 * Split-brain protection: catching (and stopping) the moment two Gateways are logged in at once.
 * The leader lock should make that impossible; this is the second line, for when it fails anyway
 * (e.g. a leader cut off from Redis but not from Discord).
 *
 * 1. Every Discord event is claimed by id (`claimEvent`) before any handler runs. The first
 *    Gateway to claim it handles it; a second one skips it — so even during a split brain no
 *    message or command is handled twice — and has just proved two sessions exist.
 * 2. Every job carries the Gateway that queued it (`origin`). Workers watch for jobs from two
 *    Gateways interleaving (A, then B, then A again — repeatedly), which a normal handover
 *    (A, then B) never produces, and record the conflict.
 */

export const SPLIT_BRAIN_KEYS = {
    event: (eventId: string) => `gateway:event:${eventId}`,
    origins: "gateway:origins",
    interleave: "gateway:interleave:",
    conflict: "gateway:conflict",
} as const;

/** Events are remembered long enough to cover any gap between two sessions receiving the same one. */
const EVENT_TTL_MS = 120_000;
/** Jobs from two Gateways closer than this count as simultaneous. */
const ORIGIN_WINDOW_MS = 60_000;
/** Interleavings needed before calling it a split brain — a handback (A, B, A) produces one. */
const INTERLEAVES_FOR_CONFLICT = 3;
const CONFLICT_TTL_MS = 10 * 60_000;

/** Returns who owns the event — us if we claimed it first. */
export const CLAIM_EVENT = `
local current = redis.call('GET', KEYS[1])
if current then return current end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
return ARGV[1]
`;

/** Records a job's origin; returns the other Gateway once interleaving keeps happening. */
export const RECORD_ORIGIN = `
local me, t, window = ARGV[1], tonumber(ARGV[2]), tonumber(ARGV[3])
local prev = tonumber(redis.call('HGET', KEYS[1], me) or '0')
local found = false
local all = redis.call('HGETALL', KEYS[1])
for i = 1, #all, 2 do
    local other, ot = all[i], tonumber(all[i + 1])
    if other ~= me and prev > 0 and prev < ot and t > ot and t - ot < window then found = other end
end
if t > prev then redis.call('HSET', KEYS[1], me, t) end
redis.call('PEXPIRE', KEYS[1], window * 10)
if not found then return false end
local pair = (me < found) and (me .. '|' .. found) or (found .. '|' .. me)
local n = redis.call('INCR', KEYS[2] .. pair)
redis.call('PEXPIRE', KEYS[2] .. pair, window)
if n >= tonumber(ARGV[4]) then return found end
return false
`;

const client = (redis?: LeaderRedis): LeaderRedis => redis ?? (getRedis() as unknown as LeaderRedis);

export async function claimEvent(eventId: string, gatewayId: string, redis?: LeaderRedis): Promise<string> {
    const owner = await client(redis).eval(CLAIM_EVENT, 1, SPLIT_BRAIN_KEYS.event(eventId), gatewayId, String(EVENT_TTL_MS));
    return String(owner);
}

/** `enqueuedAt` is the job's own timestamp, so jobs processed out of order still compare correctly. */
export async function recordJobOrigin(origin: string, enqueuedAt: number, redis?: LeaderRedis): Promise<string | null> {
    const other = await client(redis).eval(
        RECORD_ORIGIN, 2, SPLIT_BRAIN_KEYS.origins, SPLIT_BRAIN_KEYS.interleave,
        origin, String(enqueuedAt), String(ORIGIN_WINDOW_MS), String(INTERLEAVES_FOR_CONFLICT),
    );
    return typeof other === "string" ? other : null;
}

export interface GatewayConflict {
    gateways: [string, string];
    detectedBy: string;
    at: number;
}

/** Records a conflict for the leader to act on and alert about. Kept 10 minutes. */
export async function reportGatewayConflict(a: string, b: string, detectedBy: string, redis?: LeaderRedis): Promise<void> {
    const conflict: GatewayConflict = { gateways: [a, b], detectedBy, at: Date.now() };
    await client(redis).set(SPLIT_BRAIN_KEYS.conflict, JSON.stringify(conflict), "PX", CONFLICT_TTL_MS);
}

export async function readGatewayConflict(redis?: LeaderRedis): Promise<GatewayConflict | null> {
    const raw = await client(redis).get(SPLIT_BRAIN_KEYS.conflict);
    if (!raw) return null;
    try {
        return JSON.parse(raw) as GatewayConflict;
    } catch {
        return null;
    }
}

export async function clearGatewayConflict(redis?: LeaderRedis): Promise<void> {
    await client(redis).del(SPLIT_BRAIN_KEYS.conflict);
}

/** The Gateway currently holding the leader lock. */
export async function currentLeader(redis?: LeaderRedis): Promise<string | null> {
    return client(redis).get(LEADER_KEYS.lock);
}
