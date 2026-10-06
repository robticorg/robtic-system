/**
 * Gateway failover checks — no Redis, no Discord: a fake Redis (one shared store, a client per
 * container that can be cut off) with real expiry, and short timings.
 */
import { acquireLeadership, LEADER_KEYS, type LeaderRedis, type Leadership } from "@queue";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const timing = { ttlMs: 300, renewMs: 80, pollMs: 40 };
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const store = new Map<string, { value: string; expiresAt: number }>();
const read = (key: string) => {
    const entry = store.get(key);
    if (!entry || entry.expiresAt <= Date.now()) { store.delete(key); return null; }
    return entry.value;
};

/** One container's connection to the shared fake Redis; `down` cuts it off. */
function client(): LeaderRedis & { down: boolean } {
    const guard = () => { if (c.down) throw new Error("Connection is closed."); };
    const c = {
        down: false,
        async set(key: string, value: string, _px: "PX", ms: number) { guard(); store.set(key, { value, expiresAt: Date.now() + ms }); return "OK"; },
        async get(key: string) { guard(); return read(key); },
        async del(key: string) { guard(); return store.delete(key) ? 1 : 0; },
        async exists(key: string) { guard(); return read(key) === null ? 0 : 1; },
        async eval(_script: string, _n: number, key: string, id: string, ttl?: string) {
            guard();
            const current = read(key);
            if (ttl === undefined) { // release
                if (current === id) { store.delete(key); return 1; }
                return 0;
            }
            if (current === id || current === null) { store.set(key, { value: id, expiresAt: Date.now() + Number(ttl) }); return 1; }
            return 0;
        },
    };
    return c;
}

function start(role: "primary" | "standby", id: string, redis: LeaderRedis) {
    const state = { leading: false, lost: null as string | null, handle: null as Leadership | null };
    const promise = acquireLeadership({ role, id, redis, timing, onLost: reason => { state.lost = reason; state.leading = false; } })
        .then(handle => { state.leading = true; state.handle = handle; return handle; });
    return { state, promise };
}

// ── Normal operation ──────────────────────────────────────────────────────────────────────────
const primaryRedis = client();
const standbyRedis = client();
const primary = start("primary", "primary:a", primaryRedis);
await primary.promise;
check("primary takes the lock when it's free", primary.state.leading && read(LEADER_KEYS.lock) === "primary:a");

const standby = start("standby", "standby:b", standbyRedis);
await sleep(timing.ttlMs * 2);
check("standby waits while the primary keeps renewing", !standby.state.leading && primary.state.lost === null);

// ── Primary dies (stops renewing, never releases) ─────────────────────────────────────────────
primaryRedis.down = true; // from the lock's point of view a dead process and a cut-off one look the same
const diedAt = Date.now();
await standby.promise;
const takeover = Date.now() - diedAt;
check("standby takes over once the lock expires", standby.state.leading && read(LEADER_KEYS.lock) === "standby:b", `${takeover}ms`);
check("…not before the lock's TTL (no overlap)", takeover >= timing.ttlMs - timing.renewMs);

// The old primary comes back (it was hung/cut off, not dead): it must notice and step down.
primaryRedis.down = false;
await sleep(timing.renewMs * 2);
check("a primary that lost its lock while cut off steps down", primary.state.lost === "another Gateway holds the leader lock");
await primary.state.handle?.release();
check("…and its release doesn't free the standby's lock", read(LEADER_KEYS.lock) === "standby:b");

// ── Primary restarts: standby hands back ──────────────────────────────────────────────────────
const restarted = start("primary", "primary:c", client());
await sleep(timing.renewMs * 3);
check("standby hands back when the primary is waiting", standby.state.lost === "the primary Gateway is back");
await standby.state.handle?.release(); // what the Gateway does: log out, release, exit
await restarted.promise;
check("primary leads again", restarted.state.leading && read(LEADER_KEYS.lock) === "primary:c");
check("primary-waiting flag cleared", read(LEADER_KEYS.primaryWaiting) === null);

// ── Same container restarted by Docker (same hostname) ────────────────────────────────────────
const quickRestart = start("primary", "primary:c", client());
const t0 = Date.now();
await quickRestart.promise;
check("a container restarted by Docker reclaims its own lock at once", Date.now() - t0 < timing.ttlMs, `${Date.now() - t0}ms`);
await restarted.state.handle?.release();
await quickRestart.state.handle?.release();

// ── Redis down at boot ────────────────────────────────────────────────────────────────────────
store.clear();
const offline = client();
offline.down = true;
const lonePrimary = start("primary", "primary:d", offline);
const loneStandby = start("standby", "standby:e", offline);
await sleep(timing.ttlMs + timing.pollMs * 4);
check("primary starts anyway when Redis is unreachable (pre-failover behavior)", lonePrimary.state.leading);
check("standby never starts without the lock", !loneStandby.state.leading);
await lonePrimary.state.handle?.release();

// ── Release on shutdown → instant takeover ────────────────────────────────────────────────────
offline.down = false;
store.clear();
const p2 = start("primary", "primary:f", client());
await p2.promise;
const s2 = start("standby", "standby:g", client());
await sleep(timing.pollMs * 2);
const released = Date.now();
await p2.state.handle?.release();
await s2.promise;
check("a clean shutdown hands over in about one poll, not a TTL", Date.now() - released < timing.ttlMs, `${Date.now() - released}ms`);
await s2.state.handle?.release();

// loneStandby is still polling a dead connection; nothing else is pending.
if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll failover checks passed.");
process.exit(0);
