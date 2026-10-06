/**
 * Split-brain protection checks — no Redis, no Discord: a fake Redis for event claims, fake
 * clients for the event loader.
 */
import { EventEmitter } from "node:events";
import { Events } from "discord.js";
import { eventIdFor, setEventGuard, shouldHandle } from "@core/event-guard";
import { registerEventModule } from "@core/loader/register-event-module";
import { claimEvent, type LeaderRedis } from "@queue";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const store = new Map<string, string>();
const redis: LeaderRedis = {
    async set(key, value) { store.set(key, value); return "OK"; },
    async get(key) { return store.get(key) ?? null; },
    async del(key) { return store.delete(key) ? 1 : 0; },
    async exists(key) { return store.has(key) ? 1 : 0; },
    async eval(_script, _n, key, id) { // CLAIM_EVENT
        const current = store.get(key);
        if (current) return current;
        store.set(key, id);
        return id;
    },
};

// ── Event ids ─────────────────────────────────────────────────────────────────────────────────
check("message id", eventIdFor(Events.MessageCreate, [{ id: "111" }]) === "msg:111");
check("interaction id", eventIdFor(Events.InteractionCreate, [{ id: "222" }]) === "int:222");
check("reaction id: message + user + emoji",
    eventIdFor(Events.MessageReactionAdd, [{ message: { id: "1" }, emoji: { id: null, name: "🔥" } }, { id: "9" }]) === "react:1:9:🔥");
check("join id: guild + member + join time",
    eventIdFor(Events.GuildMemberAdd, [{ id: "5", guild: { id: "7" }, joinedTimestamp: 42 }]) === "join:7:5:42");
check("other events aren't gated", eventIdFor(Events.VoiceStateUpdate, [{ id: "x" }]) === null);

// ── Claims ────────────────────────────────────────────────────────────────────────────────────
check("first Gateway to claim an event owns it", (await claimEvent("msg:1", "primary:a", redis)) === "primary:a");
check("the second one learns who owns it", (await claimEvent("msg:1", "standby:b", redis)) === "primary:a");
check("the owner re-claiming keeps it", (await claimEvent("msg:1", "primary:a", redis)) === "primary:a");

// ── Guard ─────────────────────────────────────────────────────────────────────────────────────
setEventGuard(null);
check("no guard: handled synchronously, as before", shouldHandle(Events.MessageCreate, [{ id: "1" }]) === true);

let guardCalls = 0;
setEventGuard(async () => { guardCalls++; return true; });
await Promise.all([shouldHandle(Events.MessageCreate, [{ id: "2" }]), shouldHandle(Events.MessageCreate, [{ id: "2" }])]);
check("all listeners of one event share one decision (one Redis call)", guardCalls === 1);

setEventGuard(async () => { throw new Error("Redis down"); });
check("guard error fails open (event still handled)", (await shouldHandle(Events.MessageCreate, [{ id: "3" }])) === true);

// ── Two Gateways logged in at once ────────────────────────────────────────────────────────────
function gateway(id: string) {
    const emitter = new EventEmitter();
    const client = { asEmitter: () => emitter, eventBindings: [] as unknown[] };
    const handled: string[] = [];
    const conflicts: string[] = [];
    registerEventModule(
        client as never,
        { name: Events.MessageCreate, execute: (message: { id: string }) => { handled.push(message.id); } },
        "test.event.ts",
        { invalid: [], events: 0 } as never,
    );
    const guard = async (eventId: string) => {
        const owner = await claimEvent(eventId, id, redis);
        if (owner === id) return true;
        conflicts.push(owner);
        return false;
    };
    return { emitter, handled, conflicts, guard };
}

store.clear();
const a = gateway("primary:a");
const b = gateway("standby:b");
const deliver = async (g: ReturnType<typeof gateway>, messageId: string) => {
    setEventGuard(g.guard); // one process each in reality; here they take turns
    g.emitter.emit(Events.MessageCreate, { id: messageId });
    await new Promise(resolve => setTimeout(resolve, 5));
};

for (const id of ["10", "11", "12"]) {
    await deliver(a, id); // both sessions receive every message…
    await deliver(b, id);
}
check("split brain: every message handled exactly once", a.handled.length + b.handled.length === 3 && new Set([...a.handled, ...b.handled]).size === 3);
check("split brain: the second Gateway detects it, naming the first", b.conflicts.length === 3 && b.conflicts.every(c => c === "primary:a"));

await deliver(b, "13"); // the other one wins a race
await deliver(a, "13");
check("whoever receives first handles it; the other detects it", b.handled.includes("13") && !a.handled.includes("13") && a.conflicts.includes("standby:b"));

setEventGuard(null);
if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll split-brain checks passed.");
