/**
 * Queued voice XP checks — no Redis, no MongoDB, no Discord: the store is in memory and mirrors the
 * repository guards (per-tick key + levels-before snapshot, period batch ids, unique log keys,
 * Points keyed by tick, `$max` levels).
 */
import { UnrecoverableError } from "bullmq";
import { applyVoiceXp, calculateLevel, type Levels, type VoiceXpInput, type VoiceXpStore } from "@core/xp";
import { jobIds, type DiscordOutboxJob, type VoiceTickJob } from "@queue";
import { processVoiceJob } from "../apps/worker/src/processors/voice";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const G = "123456789012345678";
const U = "234567890123456789";
const V = "345678901234567890";
const T0 = Date.parse("2026-10-06T20:00:00.000Z");

function memoryStore(start: { voiceXP: number; totalXP: number } & Levels, rate = 2) {
    const row = { ...start, jobs: [] as string[], prev: null as Levels | null };
    const periods = new Map<string, { value: number; batches: string[] }>();
    const logs = new Set<string>();
    const paidKeys = new Map<string, number>();
    let progress = 0;
    let failAt = -1;
    let calls = 0;
    const maybeFail = () => { if (++calls === failAt) throw new Error("MongoNetworkError: simulated crash"); };

    const store: VoiceXpStore = {
        async addXpOnce(i, jobKey) {
            maybeFail();
            if (!row.jobs.includes(jobKey)) {
                row.prev = { level: row.level, messageLevel: row.messageLevel, voiceLevel: row.voiceLevel };
                row.jobs = [...row.jobs, jobKey].slice(-20);
                row.voiceXP += i.xp;
                row.totalXP += i.xp;
            }
            return { record: { ...row }, prev: row.jobs.at(-1) === jobKey ? row.prev : null };
        },
        async addPeriod(_i, metric, period, periodKey, amount, jobKey) {
            maybeFail();
            const key = `${metric}|${period}|${periodKey}`;
            const doc = periods.get(key) ?? { value: 0, batches: [] };
            periods.set(key, doc);
            if (doc.batches.includes(jobKey)) return false;
            doc.value += amount; doc.batches = [...doc.batches, jobKey].slice(-10);
            return true;
        },
        async raiseLevels(_i, levels) {
            maybeFail();
            for (const [k, v] of Object.entries(levels) as Array<[keyof Levels, number]>) row[k] = Math.max(row[k], v);
        },
        async logOnce(key) { maybeFail(); logs.add(key); },
        async addPoints(_i, minutes, jobKey) {
            maybeFail();
            if (paidKeys.has(jobKey)) return paidKeys.get(jobKey)!;
            progress += minutes;
            const earned = Math.floor(progress / rate);
            progress -= earned * rate;
            paidKeys.set(jobKey, earned);
            return earned;
        },
    };
    const paid = () => [...paidKeys.values()].reduce((a, b) => a + b, 0);
    return { store, row, periods, logs, paid, failNext: (n: number) => { calls = 0; failAt = n; } };
}

const input = (tick: number, xp = 10): VoiceXpInput => ({
    guildId: G, memberId: U, username: "u", xp, seconds: 60, at: new Date(T0 + tick * 60_000), tickKey: `${G}-${T0 + tick * 60_000}`,
});
const start = () => ({ voiceXP: 95, totalXP: 300, level: 2, messageLevel: 2, voiceLevel: 0 });

// ── applyVoiceXp ──────────────────────────────────────────────────────────────────────────────
await (async () => {
    const mem = memoryStore(start());
    const out = await applyVoiceXp(input(0), mem.store);
    check("apply: crossing a voice level reports it", out.status === "applied" && out.leveledUp && out.previousLevel === 0 && out.newLevel === 1);
    check("apply: message level carried for the reward check", out.status === "applied" && out.messageLevel === 2);
    check("apply: voice XP and level written, combined level never lowered",
        mem.row.voiceXP === 105 && mem.row.voiceLevel === 1 && mem.row.level === Math.max(2, calculateLevel(310)));
    check("apply: xp, voiceXp and voiceTime periods (4 buckets each)", mem.periods.size === 12
        && [...mem.periods].every(([k, v]) => v.value === (k.startsWith("voiceTime") ? 60 : 10)));
    check("apply: gain and level-up logged", mem.logs.size === 2);

    const again = await applyVoiceXp(input(0), mem.store);
    check("replay: same tick → XP, periods, logs unchanged", mem.row.voiceXP === 105 && mem.logs.size === 2
        && [...mem.periods].every(([k, v]) => v.value === (k.startsWith("voiceTime") ? 60 : 10)));
    check("replay: level-up still reported (outbox id dedupes it)", again.status === "applied" && again.leveledUp);

    await applyVoiceXp(input(1), mem.store);
    await applyVoiceXp(input(2), mem.store);
    check("voice points: 1 per 2 active minutes, never twice for a tick", mem.paid() === 1);
    const late = await applyVoiceXp(input(0), mem.store);
    check("a tick retried after newer ticks is superseded (no double XP)", late.status === "superseded" && mem.row.voiceXP === 125);

    // Crash right after the XP landed, then newer ticks, then the late retry: it still finishes its own stats/log/points.
    const lagged = memoryStore(start());
    lagged.failNext(2); // the first period write
    try { await applyVoiceXp(input(0), lagged.store); } catch { /* crash */ }
    lagged.failNext(-1);
    await applyVoiceXp(input(1), lagged.store);
    await applyVoiceXp(input(0), lagged.store);
    check("late retry after a crash: its stats, log and points are still written once",
        lagged.row.voiceXP === 115 && [...lagged.periods].every(([k, v]) => v.value === (k.startsWith("voiceTime") ? 120 : 20)) && lagged.paid() === 1);
})();

await (async () => {
    const snapshot = (m: ReturnType<typeof memoryStore>) => JSON.stringify([m.row.voiceXP, m.row.voiceLevel, m.row.level, [...m.periods].map(([k, v]) => [k, v.value]), [...m.logs], m.paid()]);
    const run = async (m: ReturnType<typeof memoryStore>) => { await applyVoiceXp(input(0), m.store); await applyVoiceXp(input(1), m.store); };
    const clean = memoryStore(start());
    await run(clean);
    const expected = snapshot(clean);

    let allMatch = true;
    for (let crashAt = 1; crashAt <= 36; crashAt++) {
        const mem = memoryStore(start());
        mem.failNext(crashAt);
        try { await run(mem); } catch { /* the simulated crash */ }
        mem.failNext(-1);
        await run(mem);
        if (snapshot(mem) !== expected) { allMatch = false; console.log(`  crash at ${crashAt}: ${snapshot(mem)} vs ${expected}`); }
    }
    check("crash anywhere + retry = each tick applied once (XP, stats, logs, points)", allMatch);
})();

// ── Worker processor ──────────────────────────────────────────────────────────────────────────
const tick = (over: Partial<VoiceTickJob> = {}): VoiceTickJob => ({
    kind: "voice-tick", guildId: G, tickAt: T0, requestId: "r",
    members: [{ memberId: U, username: "u", xp: 12, seconds: 60 }, { memberId: V, username: "v", xp: 7, seconds: 60 }],
    ...over,
});

await (async () => {
    const applied: VoiceXpInput[] = [];
    const posted: Array<[DiscordOutboxJob, string]> = [];
    const result = await processVoiceJob(tick(), {
        apply: async i => {
            applied.push(i);
            return i.memberId === U
                ? { status: "applied", leveledUp: true, previousLevel: 4, newLevel: 5, messageLevel: 9, points: 0 }
                : { status: "applied", leveledUp: false, previousLevel: 1, newLevel: 1, messageLevel: 0, points: 0 };
        },
        outbox: async (j, id) => { posted.push([j, id]); },
    });
    check("worker: every member of the tick applied, same tick key", applied.length === 2 && applied.every(i => i.tickKey === `${G}-${T0}` && i.at.getTime() === T0));
    check("worker: only real level-ups go to the outbox", result.levelUps === 1 && posted.length === 1);
    const [job, id] = posted[0]!;
    check("worker: voice level-up with both levels, id per level",
        id === jobIds.levelUp(G, U, "voice", 5) && job.kind === "level-up" && job.xpKind === "voice" && job.levels.voiceLevel === 5 && job.levels.messageLevel === 9);

    const rejects = async (j: VoiceTickJob) => {
        try { await processVoiceJob(j, { apply: async () => ({ status: "superseded" }), outbox: async () => {} }); return false; }
        catch (err) { return err instanceof UnrecoverableError; }
    };
    check("worker: bad guild id fails permanently", await rejects(tick({ guildId: "x" })));
    check("worker: bad member or xp fails permanently",
        (await rejects(tick({ members: [{ memberId: "nope", username: "u", xp: 5, seconds: 60 }] })))
        && (await rejects(tick({ members: [{ memberId: U, username: "u", xp: 0, seconds: 60 }] }))));
    check("worker: bad tick time fails permanently", await rejects(tick({ tickAt: -1 })));
    check("voice tick job id: per guild per minute, BullMQ-safe", jobIds.voiceTick(G, T0) === `voice_${G}_${T0}`);
})();

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll queued voice checks passed.");
