/**
 * Queued combo checks — no Redis, no MongoDB: the store is in memory and mirrors the repository
 * guards (recent message ids on the pair, Points keyed by message, conditional end).
 */
import { UnrecoverableError } from "bullmq";
import { COMBO_CONFIG } from "@constants";
import { applyComboMessage, computeHeat, type ComboMessageInput, type ComboStore } from "@core/combo";
import type { ICombo } from "@database/models";
import { jobIds, type ComboMessageJob } from "@queue";
import { processComboJob } from "../apps/worker/src/processors/combo";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const G = "123456789012345678";
const A = "234567890123456789";
const B = "345678901234567890";
const T0 = Date.parse("2026-10-06T12:00:00.000Z");

function memoryStore(opts: { punishment?: number; rate?: number } = {}) {
    const rate = opts.rate ?? 10;
    let pair: ICombo | null = null;
    let progress = 0;
    const paid = new Map<string, number>();
    let finalized = 0;
    let records = 0;
    let failAt = -1;
    let calls = 0;
    const maybeFail = () => { if (++calls === failAt) throw new Error("MongoNetworkError: simulated crash"); };

    const fresh = (at: Date): ICombo => ({
        guildId: G, userLowId: A, userHighId: B, status: "active", currentScore: 0, bestScore: 0, messages: 0,
        totalDurationMs: 0, totalWords: 0, totalCharacters: 0, heat: 0, level: "", lastMessageBy: "",
        lastMessageAt: at, lastMessageAtLow: at, lastMessageAtHigh: at, startedAt: at,
        streakCurrent: 0, streakBest: 0, lastStreakDateKey: "", appliedMessages: [],
    } as unknown as ICombo);

    const store: ComboStore = {
        async findOrCreate() { maybeFail(); pair ??= fresh(new Date(T0)); return { ...pair } as ICombo; },
        async finalize(p) { maybeFail(); if (pair && pair.status === "active" && p.status === "active") { pair.status = "ended"; finalized++; } },
        async restart(_g, _a, _b, at) { maybeFail(); pair = { ...fresh(at), streakCurrent: pair?.streakCurrent ?? 0 } as ICombo; return { ...pair } as ICombo; },
        async applyMessage(i, scoreGain, heat, durationDeltaMs) {
            maybeFail();
            if (!pair || pair.appliedMessages.includes(i.messageId)) return null;
            const low = i.authorId === A;
            pair = {
                ...pair,
                appliedMessages: [...pair.appliedMessages, i.messageId].slice(-20),
                currentScore: pair.currentScore + scoreGain,
                messages: pair.messages + 1,
                totalDurationMs: pair.totalDurationMs + durationDeltaMs,
                heat,
                lastMessageBy: i.authorId,
                lastMessageAt: new Date(Math.max(pair.lastMessageAt.getTime(), i.at.getTime())),
                ...(low ? { lastMessageAtLow: new Date(Math.max(pair.lastMessageAtLow.getTime(), i.at.getTime())) }
                    : { lastMessageAtHigh: new Date(Math.max(pair.lastMessageAtHigh.getTime(), i.at.getTime())) }),
                status: "active",
            } as ICombo;
            return { ...pair } as ICombo;
        },
        async scoreRange() { return { min: 10, max: 20 }; },
        async punishmentLevel() { return opts.punishment ?? 0; },
        async addPoints(i, scoreGain) {
            maybeFail();
            const key = `combo-${i.messageId}`;
            if (paid.has(key)) return paid.get(key)!;
            progress += scoreGain;
            const earned = Math.floor(progress / rate);
            progress -= earned * rate;
            paid.set(key, earned);
            return earned;
        },
        async liveRecords() { maybeFail(); records++; },
    };
    return {
        store,
        get pair() { return pair; },
        get finalized() { return finalized; },
        get records() { return records; },
        totalPaid: () => [...paid.values()].reduce((a, b) => a + b, 0),
        failNext: (n: number) => { calls = 0; failAt = n; },
    };
}

const msg = (id: string, authorId: string, offsetMs: number, over: Partial<ComboMessageInput> = {}): ComboMessageInput => ({
    guildId: G, authorId, partnerId: authorId === A ? B : A, username: "u", messageId: id, confidence: 1,
    at: new Date(T0 + offsetMs), countable: true, wordCount: 3, characterCount: 15, ...over,
});

const partners: string[] = [];
const cachePartners = async (_g: string, a: string, b: string, score: number) => { partners.push(`${a}>${b}:${score}`); };

// ── Applying messages ─────────────────────────────────────────────────────────────────────────
await (async () => {
    const mem = memoryStore();
    const first = await applyComboMessage(msg("1300000000000000001", A, 1_000), { store: mem.store, cachePartners });
    check("apply: full-confidence message scores the range max", first.status === "applied" && first.scoreGain === 20 && first.score === 20);
    check("apply: points paid from combo progress", first.status === "applied" && first.points === 2);
    check("apply: partner cache gets the new score", partners.at(-1) === `${A}>${B}:20`);
    check("apply: live records checked", mem.records === 1);

    const reply = await applyComboMessage(msg("1300000000000000002", B, 6_000, { confidence: 0.5 }), { store: mem.store, cachePartners });
    check("apply: half confidence scores the middle of the range", reply.status === "applied" && reply.scoreGain === 15 && reply.score === 35);
    check("apply: alternating reply raises heat as computed", mem.pair!.heat === computeHeat(computeHeat(0, 0, false, 1), 5_000, true, 0.5));
    check("apply: duration grows by the gap", mem.pair!.totalDurationMs === 5_000);

    const again = await applyComboMessage(msg("1300000000000000002", B, 6_000, { confidence: 0.5 }), { store: mem.store, cachePartners });
    check("replay: same message is a duplicate, score unchanged", again.status === "duplicate" && mem.pair!.currentScore === 35 && mem.pair!.messages === 2);
    check("replay: no extra points", mem.totalPaid() === 3);

    const short = await applyComboMessage(msg("1300000000000000003", A, 7_000, { countable: false }), { store: mem.store, cachePartners });
    check("short message: not counted, keeps the partner cache warm", short.status === "not-counted" && mem.pair!.messages === 2 && partners.at(-1) === `${A}>${B}:35`);

    const late = await applyComboMessage(msg("1300000000000000004", A, 3_000), { store: mem.store, cachePartners });
    check("out of order: an older message never rewinds the clock", late.status === "applied" && mem.pair!.lastMessageAt.getTime() === T0 + 6_000);
})();

await (async () => {
    const mem = memoryStore();
    await applyComboMessage(msg("1300000000000000001", A, 1_000), { store: mem.store, cachePartners });
    const afterGap = await applyComboMessage(msg("1300000000000000002", B, 1_000 + COMBO_CONFIG.expireMs + 1), { store: mem.store, cachePartners });
    check("stale pair: archived once, restarted, new message counted fresh", mem.finalized === 1 && afterGap.status === "applied" && afterGap.score === 20 && mem.pair!.messages === 1);

    const retry = await applyComboMessage(msg("1300000000000000002", B, 1_000 + COMBO_CONFIG.expireMs + 1), { store: mem.store, cachePartners });
    check("stale pair: a retry doesn't archive or restart again", mem.finalized === 1 && retry.status === "duplicate" && mem.pair!.messages === 1);
})();

await (async () => {
    const mem = memoryStore({ punishment: COMBO_CONFIG.punishmentGateThreshold });
    const out = await applyComboMessage(msg("1300000000000000001", A, 1_000), { store: mem.store, cachePartners });
    check("punished author: score gain is gated", out.status === "applied" && out.scoreGain === Math.max(1, Math.round(20 * COMBO_CONFIG.punishmentGateMultiplier)));
})();

await (async () => {
    // A crash at every write, then a retry: same end state as one clean run.
    const run = async (mem: ReturnType<typeof memoryStore>) => {
        await applyComboMessage(msg("1300000000000000001", A, 1_000), { store: mem.store, cachePartners });
        await applyComboMessage(msg("1300000000000000002", B, 4_000, { confidence: 0.7 }), { store: mem.store, cachePartners });
    };
    const snapshot = (m: ReturnType<typeof memoryStore>) => JSON.stringify([m.pair!.currentScore, m.pair!.messages, Math.round(m.pair!.heat * 1000), m.pair!.totalDurationMs, m.totalPaid()]);
    const clean = memoryStore();
    await run(clean);
    const expected = snapshot(clean);

    let allMatch = true;
    for (let crashAt = 1; crashAt <= 14; crashAt++) {
        const mem = memoryStore();
        mem.failNext(crashAt);
        try { await run(mem); } catch { /* the simulated crash */ }
        mem.failNext(-1);
        await run(mem); // the queue retries; both messages are replayed
        if (snapshot(mem) !== expected) { allMatch = false; console.log(`  crash at ${crashAt}: ${snapshot(mem)} vs ${expected}`); }
    }
    check("crash anywhere + retry = each message counted once, points paid once", allMatch);
})();

// ── Worker processor ──────────────────────────────────────────────────────────────────────────
await (async () => {
    const job = (over: Partial<ComboMessageJob> = {}): ComboMessageJob => ({
        kind: "combo-message", guildId: G, authorId: A, partnerId: B, username: "u", messageId: "1300000000000000009",
        confidence: 0.8, at: new Date(T0).toISOString(), countable: true, wordCount: 2, characterCount: 9, requestId: "r", ...over,
    });
    let received: ComboMessageInput | null = null;
    const deps = { apply: (async (i: ComboMessageInput) => { received = i; return { status: "gone" }; }) as never, cachePartners: async () => {} };

    await processComboJob(job(), deps);
    check("worker: job turned into the core input (dates revived)", received !== null && (received as ComboMessageInput).at.getTime() === T0 && (received as ComboMessageInput).confidence === 0.8);

    const rejects = async (j: ComboMessageJob) => {
        try { await processComboJob(j, deps); return false; } catch (err) { return err instanceof UnrecoverableError; }
    };
    check("worker: invalid ids fail permanently", await rejects(job({ partnerId: "nope" })));
    check("worker: self-combo fails permanently", await rejects(job({ partnerId: A })));
    check("worker: confidence outside 0–1 fails permanently", (await rejects(job({ confidence: 1.5 }))) && (await rejects(job({ confidence: Number.NaN }))));
    check("worker: bad timestamp fails permanently", await rejects(job({ at: "soon" })));
    check("combo job id is per message and BullMQ-safe", jobIds.comboMessage(G, "1300000000000000009") === `combo_${G}_1300000000000000009`);
})();

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll queued combo checks passed.");
