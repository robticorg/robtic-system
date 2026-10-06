/**
 * Queued message-XP checks — no Redis, no MongoDB, no Discord: the store is in memory and mirrors
 * the repositories' guards (job-key snapshot, period batch ids, unique log keys, `$max` levels).
 */
import { UnrecoverableError } from "bullmq";
import { applyMessageXp, calculateLevel, type Levels, type MessageXpInput, type MessageXpStore } from "@core/xp";
import { jobIds, type DiscordOutboxJob, type MessageXpJob } from "@queue";
import { processXpJob } from "../apps/worker/src/processors/xp";
import { processOutboxJob } from "../apps/bot/src/services/discord-outbox";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const G = "123456789012345678";
const U = "234567890123456789";
const M1 = "1300000000000000001";
const M2 = "1300000000000000002";

function memoryStore(start: { messageXP: number; totalXP: number } & Levels) {
    const row = { ...start, xpJobs: [] as string[], xpJobPrev: null as Levels | null };
    const periods = new Map<string, { value: number; batches: string[] }>();
    const logs = new Map<string, { type: string; amount: number }>();
    let failAt = -1;
    let calls = 0;
    const maybeFail = () => { if (++calls === failAt) throw new Error("MongoNetworkError: simulated crash"); };

    const store: MessageXpStore = {
        async addXpOnce(i: MessageXpInput, jobKey: string) {
            maybeFail();
            if (!row.xpJobs.includes(jobKey)) {
                row.xpJobPrev = { level: row.level, messageLevel: row.messageLevel, voiceLevel: row.voiceLevel };
                row.xpJobs = [...row.xpJobs, jobKey].slice(-20);
                row.messageXP += i.xp;
                row.totalXP += i.xp;
                return { record: { ...row }, prev: row.xpJobPrev };
            }
            return { record: { ...row }, prev: row.xpJobs.at(-1) === jobKey ? row.xpJobPrev : null };
        },
        async addPeriod(i, metric, period, periodKey, jobKey) {
            maybeFail();
            const key = `${metric}|${period}|${periodKey}`;
            const doc = periods.get(key) ?? { value: 0, batches: [] };
            periods.set(key, doc);
            if (doc.batches.includes(jobKey)) return false;
            doc.value += i.xp; doc.batches = [...doc.batches, jobKey].slice(-10);
            return true;
        },
        async raiseLevels(_i, levels) {
            maybeFail();
            for (const [k, v] of Object.entries(levels) as Array<[keyof Levels, number]>) row[k] = Math.max(row[k], v);
        },
        async logOnce(key, _i, type, amount) {
            maybeFail();
            if (logs.has(key)) return false;
            logs.set(key, { type, amount });
            return true;
        },
    };
    return { store, row, periods, logs, failNext: (n: number) => { calls = 0; failAt = n; } };
}

const input = (messageId: string, xp: number): MessageXpInput => ({ guildId: G, memberId: U, username: "raouf", messageId, xp, at: new Date("2026-10-05T12:00:00.000Z") });
const startRow = () => ({ messageXP: 95, totalXP: 95, level: 0, messageLevel: 0, voiceLevel: 3 });

// ── applyMessageXp ────────────────────────────────────────────────────────────────────────────
await (async () => {
    check("levels: 95 XP is level 0, 105 is level 1", calculateLevel(95) === 0 && calculateLevel(105) === 1);

    const mem = memoryStore(startRow());
    const out = await applyMessageXp(input(M1, 10), mem.store);
    check("apply: crossing a level reports the level-up", out.status === "applied" && out.leveledUp && out.previousLevel === 0 && out.newLevel === 1);
    check("apply: voice level carried for the reward check", out.status === "applied" && out.voiceLevel === 3);
    check("apply: XP and levels written", mem.row.messageXP === 105 && mem.row.messageLevel === 1 && mem.row.level === 1);
    check("apply: messageXp and xp periods, four buckets each", mem.periods.size === 8 && [...mem.periods.values()].every(p => p.value === 10));
    check("apply: xp_gain and level_up logged", mem.logs.size === 2 && [...mem.logs.values()].some(l => l.type === "level_up" && l.amount === 1));

    const again = await applyMessageXp(input(M1, 10), mem.store);
    check("replay: same job → XP not added twice", mem.row.messageXP === 105);
    check("replay: periods and logs unchanged", [...mem.periods.values()].every(p => p.value === 10) && mem.logs.size === 2);
    check("replay: still reports the level-up (the outbox id dedupes it)", again.status === "applied" && again.leveledUp && again.newLevel === 1);

    const next = await applyMessageXp(input(M2, 5), mem.store);
    check("next gain without a new level: no level-up", next.status === "applied" && !next.leveledUp && mem.row.messageXP === 110);

    const late = await applyMessageXp(input(M1, 10), mem.store);
    check("a retry after a newer gain replaced its snapshot is superseded (no double XP)", late.status === "superseded" && mem.row.messageXP === 110);
})();

await (async () => {
    // A crash at every write, then a retry: same end state as one clean run, level-up still seen.
    const snapshot = (m: ReturnType<typeof memoryStore>) => JSON.stringify([m.row.messageXP, m.row.totalXP, m.row.level, m.row.messageLevel, [...m.periods].map(([k, v]) => [k, v.value]), [...m.logs.keys()]]);
    const clean = memoryStore(startRow());
    await applyMessageXp(input(M1, 10), clean.store);
    const expected = snapshot(clean);

    let allMatch = true;
    for (let crashAt = 1; crashAt <= 12; crashAt++) {
        const mem = memoryStore(startRow());
        mem.failNext(crashAt);
        try { await applyMessageXp(input(M1, 10), mem.store); } catch { /* the simulated crash */ }
        mem.failNext(-1);
        const out = await applyMessageXp(input(M1, 10), mem.store);
        if (snapshot(mem) !== expected || out.status !== "applied" || !out.leveledUp) {
            allMatch = false;
            console.log(`  crash at write ${crashAt}: ${snapshot(mem)} vs ${expected}`);
        }
    }
    check("crash anywhere + retry = exactly one gain, level-up still reported", allMatch);

    const mem = memoryStore({ ...startRow(), messageLevel: 4, level: 4 });
    await applyMessageXp(input(M1, 10), mem.store);
    check("levels are never lowered (stored level above the XP's level)", mem.row.messageLevel === 4 && mem.row.level === 4);
})();

// ── Worker processor ──────────────────────────────────────────────────────────────────────────
const job = (over: Partial<MessageXpJob> = {}): MessageXpJob => ({
    kind: "message-xp", guildId: G, memberId: U, username: "raouf", messageId: M1, xp: 10, at: "2026-10-05T12:00:00.000Z", requestId: "r", ...over,
});

await (async () => {
    const posted: Array<[DiscordOutboxJob, string]> = [];
    const outbox = async (j: DiscordOutboxJob, id: string) => { posted.push([j, id]); };

    await processXpJob(job(), { apply: async () => ({ status: "applied", leveledUp: true, previousLevel: 0, newLevel: 1, voiceLevel: 3 }), outbox });
    const levelUp = posted.find(([j]) => j.kind === "level-up");
    check("worker: level-up queued with both levels, id per level",
        levelUp?.[1] === jobIds.levelUp(G, U, "message", 1) && levelUp[0].kind === "level-up" && levelUp[0].levels.messageLevel === 1 && levelUp[0].levels.voiceLevel === 3);
    check("worker: xp log queued, id per message", posted.some(([j, id]) => j.kind === "xp-gain-log" && id === jobIds.xpGainLog(G, M1)));
    check("worker: job ids are BullMQ-safe", posted.every(([, id]) => !id.includes(":")));

    posted.length = 0;
    await processXpJob(job(), { apply: async () => ({ status: "applied", leveledUp: false, previousLevel: 1, newLevel: 1, voiceLevel: 3 }), outbox });
    check("worker: no level-up → only the log", posted.length === 1 && posted[0]![0].kind === "xp-gain-log");

    posted.length = 0;
    await processXpJob(job(), { apply: async () => ({ status: "superseded" }), outbox });
    check("worker: superseded → nothing posted", posted.length === 0);

    const rejects = async (j: MessageXpJob) => {
        try { await processXpJob(j, { apply: async () => ({ status: "superseded" }), outbox }); return false; } catch (err) { return err instanceof UnrecoverableError; }
    };
    check("worker: invalid ids fail permanently", await rejects(job({ messageId: "x" })));
    check("worker: absurd XP fails permanently", (await rejects(job({ xp: 0 }))) && (await rejects(job({ xp: 5_000 }))));
    check("worker: bad timestamp fails permanently", await rejects(job({ at: "never" })));

    let threw = false;
    try { await processXpJob(job(), { apply: async () => { throw new Error("Mongo down"); }, outbox }); } catch (err) { threw = !(err instanceof UnrecoverableError); }
    check("worker: a database error is retried", threw);
})();

// ── Gateway outbox ────────────────────────────────────────────────────────────────────────────
await (async () => {
    const calls: string[] = [];
    const deps = {
        guild: (id: string) => (id === G ? ({ id: G } as never) : undefined),
        announceJoin: async () => {},
        announceLeave: async () => {},
        grantLevelRewards: async (_u: string, _g: string, levels: { messageLevel: number; voiceLevel: number }) => { calls.push(`roles:${levels.messageLevel}/${levels.voiceLevel}`); },
        announceLevelUp: async (_g: unknown, _u: string, kind: string, level: number) => { calls.push(`announce:${kind}:${level}`); },
        logXpGain: async (_n: string, _u: string, xp: number) => { calls.push(`log:${xp}`); },
    };
    await processOutboxJob({ kind: "level-up", guildId: G, memberId: U, xpKind: "message", level: 2, levels: { messageLevel: 2, voiceLevel: 3 }, requestId: "r" }, deps);
    check("outbox: level-up gives roles, then announces", calls.join(",") === "roles:2/3,announce:message:2");
    await processOutboxJob({ kind: "xp-gain-log", guildId: G, memberId: U, username: "raouf", xp: 9, leveledUp: false, level: 2, requestId: "r" }, deps);
    check("outbox: xp gain is logged", calls.at(-1) === "log:9");
    const skipped = await processOutboxJob({ kind: "xp-gain-log", guildId: "999999999999999999", memberId: U, username: "x", xp: 1, leveledUp: false, level: 0, requestId: "r" }, deps);
    check("outbox: unknown guild skipped", skipped === "skipped");
})();

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll queued XP checks passed.");
