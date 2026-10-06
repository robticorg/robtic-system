import { hostname } from "node:os";
import { getRedis } from "./message-buffer";

/**
 * Which Gateway container is logged in to Discord. Two sessions on one bot token would both get
 * every event — every command and reward would happen twice — so exactly one container (the
 * leader) logs in; the other waits, ready to take over.
 *
 * - The leader holds `gateway:leader` (a 15s lock) and renews it every 5s. If it dies or hangs,
 *   the lock expires and the standby takes over within ~15s.
 * - The lock value is the role plus the container's hostname, which survives a restart: a primary
 *   that crashes and is restarted by Docker reclaims its own lock immediately.
 * - The primary is preferred: while it waits it marks `gateway:primary-waiting`, and a standby
 *   that is leading hands back (it holds no published ports, e.g. the bank API's).
 * - Redis down: the leader keeps leading (no one else can take the lock), and a primary that can't
 *   reach Redis at boot starts anyway after `TTL_MS` — the pre-failover behavior. A standby never
 *   starts without the lock.
 */

export type GatewayRole = "primary" | "standby";

export const LEADER_KEYS = { lock: "gateway:leader", primaryWaiting: "gateway:primary-waiting" } as const;
export const LEADER_TIMING = { ttlMs: 15_000, renewMs: 5_000, pollMs: 2_000 } as const;

/** Extends our lock, or re-takes it if it expired while Redis was unreachable. 0 = someone else holds it. */
const RENEW = `
local current = redis.call('GET', KEYS[1])
if current == ARGV[1] then redis.call('PEXPIRE', KEYS[1], ARGV[2]) return 1 end
if not current then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]) return 1 end
return 0
`;

const RELEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0
`;

export interface Leadership {
    id: string;
    /** Stops renewing and frees the lock (only if still ours) so the other container takes over at once. */
    release(): Promise<void>;
}

export interface LeadershipOptions {
    role: GatewayRole;
    /** We must stop now: another container holds the lock, or (standby) the primary is back. */
    onLost: (reason: string) => void;
    log?: (message: string) => void;
    /** Overridable for tests. */
    timing?: { ttlMs: number; renewMs: number; pollMs: number };
    id?: string;
    redis?: LeaderRedis;
}

/** The Redis calls the lock needs — the real client, or a stand-in in tests. */
export interface LeaderRedis {
    set(key: string, value: string, px: "PX", ms: number): Promise<unknown>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<unknown>;
    exists(key: string): Promise<number>;
    eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function acquireLeadership(options: LeadershipOptions): Promise<Leadership> {
    const { role, onLost, log = () => {} } = options;
    const timing = options.timing ?? LEADER_TIMING;
    const id = options.id ?? `${role}:${hostname()}`;
    const redis: LeaderRedis = options.redis ?? (getRedis() as unknown as LeaderRedis);

    let unreachableSince: number | null = null;
    let announcedWait = false;
    for (;;) {
        try {
            if (role === "primary") await redis.set(LEADER_KEYS.primaryWaiting, id, "PX", timing.pollMs * 5);
            const result = Number(await redis.eval(RENEW, 1, LEADER_KEYS.lock, id, String(timing.ttlMs)));
            unreachableSince = null;
            if (result === 1) break;
            if (!announcedWait) {
                announcedWait = true;
                log(`Another Gateway is logged in (${await redis.get(LEADER_KEYS.lock).catch(() => "?")}) — waiting as ${role}`);
            }
        } catch (err) {
            unreachableSince ??= Date.now();
            if (role === "primary" && Date.now() - unreachableSince >= timing.ttlMs) {
                log(`Redis unreachable for ${timing.ttlMs / 1000}s (${(err as Error).message}) — starting without the lock`);
                break;
            }
        }
        await sleep(timing.pollMs);
    }

    if (role === "primary") await redis.del(LEADER_KEYS.primaryWaiting).catch(() => {});
    log(`Leading as ${id}`);

    let stopped = false;
    const timer = setInterval(async () => {
        if (stopped) return;
        try {
            const ours = Number(await redis.eval(RENEW, 1, LEADER_KEYS.lock, id, String(timing.ttlMs)));
            if (stopped) return;
            if (ours === 0) {
                stopped = true;
                clearInterval(timer);
                onLost("another Gateway holds the leader lock");
                return;
            }
            if (role === "standby" && (await redis.exists(LEADER_KEYS.primaryWaiting))) {
                stopped = true;
                clearInterval(timer);
                onLost("the primary Gateway is back");
            }
        } catch {
            // Redis unreachable: keep leading — nobody else can take the lock meanwhile.
        }
    }, timing.renewMs);

    return {
        id,
        async release() {
            stopped = true;
            clearInterval(timer);
            await redis.eval(RELEASE, 1, LEADER_KEYS.lock, id).catch(() => {});
        },
    };
}
