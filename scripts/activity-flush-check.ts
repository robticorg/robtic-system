/**
 * Message-counter flush checks — no Redis, no MongoDB: the store is in memory and mirrors the
 * repositories' batch-id guards, so crash-and-retry behaves exactly like production.
 */
import { UnrecoverableError } from "bullmq";
import { periodKeyFor } from "@utils";
import {
    applyMessageBatch,
    groupMessageBatch,
    messageBufferField,
    type BufferedBatch,
    type MemberBatch,
    type MessageCounterStore,
} from "@core/activity";
import { StaffApiRejected, crossedMilestones } from "@core/staff-api";
import { jobIds } from "@queue";
import { newBatchId, processMessageFlush } from "../apps/worker/src/processors/activity";
import { processStaffPointJob } from "../apps/worker/src/processors/staff-points";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const G = "123456789012345678";
const U = "234567890123456789";
const V = "345678901234567890";

/** In-memory twin of the guarded repository writes. */
function memoryStore(rate = 10) {
    const activity = new Map<string, { count: number; batch: string | null; batchCount: number }>();
    const periods = new Map<string, { value: number; batch: string | null }>();
    const points = new Map<string, { progress: number; balance: number; flush: string | null; convert: string | null }>();
    const ledger = new Set<string>();
    let failAt = -1;
    let calls = 0;
    const maybeFail = () => { if (++calls === failAt) throw new Error("MongoNetworkError: simulated crash"); };

    const store: MessageCounterStore = {
        async addRealMessages(m, batchId) {
            maybeFail();
            const key = `${m.guildId}|${m.discordId}`;
            const doc = activity.get(key) ?? { count: 0, batch: null, batchCount: 0 };
            activity.set(key, doc);
            if (doc.batch !== batchId) {
                doc.count += m.total; doc.batch = batchId; doc.batchCount = m.total;
                return { total: doc.count, added: m.total };
            }
            return { total: doc.count, added: doc.batchCount };
        },
        async addPeriod(m, period, periodKey, amount, batchId) {
            maybeFail();
            const key = `${m.guildId}|${m.discordId}|${period}|${periodKey}`;
            const doc = periods.get(key) ?? { value: 0, batch: null };
            periods.set(key, doc);
            if (doc.batch === batchId) return false;
            doc.value += amount; doc.batch = batchId;
            return true;
        },
        async addProgress(m, r, batchId) {
            maybeFail();
            const key = `${m.guildId}|${m.discordId}`;
            const doc = points.get(key) ?? { progress: 0, balance: 0, flush: null, convert: null };
            points.set(key, doc);
            if (doc.flush !== batchId) { doc.progress += m.total; doc.flush = batchId; }
            if (doc.convert === batchId) return 0;
            const earned = Math.floor(doc.progress / r);
            if (earned <= 0) return 0;
            const idem = `message-progress_${batchId}_${key}`;
            if (!ledger.has(idem)) { ledger.add(idem); doc.balance += earned; }
            maybeFail();
            doc.progress -= earned * r; doc.convert = batchId;
            return earned;
        },
        async messagesPerPoint() { return rate; },
    };
    return { store, activity, periods, points, failNext: (n: number) => { calls = 0; failAt = n; } };
}

// ── Buffer field + grouping ───────────────────────────────────────────────────────────────────
{
    const at = new Date("2026-10-04T23:59:59.000Z");
    check("buffer field: UTC day | guild | member", messageBufferField(at, G, U) === `2026-10-04|${G}|${U}`);

    const sunday = new Date("2026-10-04T00:00:00.000Z");
    const monday = new Date("2026-10-05T00:00:00.000Z");
    const batch: BufferedBatch = {
        counts: { [`2026-10-04|${G}|${U}`]: "3", [`2026-10-05|${G}|${U}`]: "2", [`2026-10-05|${G}|${V}`]: "1", garbage: "4", [`2026-10-05|${G}|x`]: "-1" },
        last: { [`${G}|${U}`]: String(Date.parse("2026-10-05T00:00:10.000Z")) },
        names: { [`${G}|${U}`]: "raouf" },
    };
    const members = groupMessageBatch(batch);
    const u = members.find(m => m.discordId === U)!;
    const v = members.find(m => m.discordId === V)!;
    check("group: one entry per member, junk fields dropped", members.length === 2);
    check("group: total summed across days", u.total === 5 && v.total === 1);
    check("group: username and last-active carried over", u.username === "raouf" && u.lastActiveAt.toISOString() === "2026-10-05T00:00:10.000Z");
    check("group: missing name/last fall back to id/day", v.username === V && v.lastActiveAt.getTime() === monday.getTime());
    check("group: across midnight, each day in its own daily bucket",
        u.periods.get(`daily|${periodKeyFor("daily", sunday)}`) === 3 && u.periods.get(`daily|${periodKeyFor("daily", monday)}`) === 2);
    const sameWeek = periodKeyFor("weekly", sunday) === periodKeyFor("weekly", monday);
    check("group: weekly buckets follow the week boundary",
        sameWeek ? u.periods.get(`weekly|${periodKeyFor("weekly", monday)}`) === 5
            : u.periods.get(`weekly|${periodKeyFor("weekly", sunday)}`) === 3 && u.periods.get(`weekly|${periodKeyFor("weekly", monday)}`) === 2);
    check("group: all-time gets everything", u.periods.get("alltime|all") === 5);
}

// ── Milestones ────────────────────────────────────────────────────────────────────────────────
check("milestones: 99 → 100 crosses 100", JSON.stringify(crossedMilestones(100, 1)) === "[100]");
check("milestones: 95 → 310 crosses 100, 200, 300", JSON.stringify(crossedMilestones(310, 215)) === "[100,200,300]");
check("milestones: 100 → 199 crosses none", crossedMilestones(199, 99).length === 0);
check("milestones: nothing added, nothing crossed", crossedMilestones(500, 0).length === 0);
check("milestone job id is stable and BullMQ-safe", jobIds.staffMilestone(G, U, 300) === `staff-msg_${G}_${U}_300` && !jobIds.staffMilestone(G, U, 300).includes(":"));
check("batch ids are unique and contain no ':'", (() => { const a = newBatchId(), b = newBatchId(); return a !== b && !a.includes(":"); })());

// ── Exactly-once apply ────────────────────────────────────────────────────────────────────────
const member = (total: number, discordId = U): MemberBatch => ({
    guildId: G, discordId, username: "raouf", total, lastActiveAt: new Date(),
    periods: new Map([["alltime|all", total], [`daily|${periodKeyFor("daily", new Date())}`, total]]),
});

await (async () => {
    const mem = memoryStore(10);
    const milestones: string[] = [];
    const onMilestone = async (g: string, u: string, m: number) => { milestones.push(jobIds.staffMilestone(g, u, m)); };

    await applyMessageBatch("b1", [member(95)], { store: mem.store, onMilestone });
    const out = await applyMessageBatch("b2", [member(110)], { store: mem.store, onMilestone });
    const doc = mem.points.get(`${G}|${U}`)!;
    check("apply: real-message total accumulates", mem.activity.get(`${G}|${U}`)!.count === 205);
    check("apply: milestones 100 and 200 emitted", JSON.stringify(milestones) === JSON.stringify([jobIds.staffMilestone(G, U, 100), jobIds.staffMilestone(G, U, 200)]));
    check("apply: points paid from progress, remainder kept", doc.balance === 20 && doc.progress === 5, `balance=${doc.balance} progress=${doc.progress}`);
    check("apply: outcome counts", out.members === 1 && out.messages === 110 && out.pointsPaid === 11 && out.milestones === 2);

    // Replaying a finished batch changes nothing (a retry after the last write but before `finish`).
    await applyMessageBatch("b2", [member(110)], { store: mem.store, onMilestone });
    check("replay: total unchanged", mem.activity.get(`${G}|${U}`)!.count === 205);
    check("replay: period buckets unchanged", mem.periods.get(`${G}|${U}|alltime|all`)!.value === 205);
    check("replay: no points paid twice", doc.balance === 20 && doc.progress === 5);
    check("replay: re-emitted milestones keep their job ids (deduped by the queue)", new Set(milestones).size === 2);
})();

await (async () => {
    // A crash at every possible write, then a retry: the end state must match one clean apply.
    const run = (mem: ReturnType<typeof memoryStore>, onMilestone: (g: string, u: string, m: number) => Promise<void>) =>
        applyMessageBatch("b", [member(57), member(250, V)], { store: mem.store, onMilestone });
    const snapshot = (m: ReturnType<typeof memoryStore>) => JSON.stringify([
        [...m.activity].map(([k, v]) => [k, v.count]),
        [...m.periods].map(([k, v]) => [k, v.value]),
        [...m.points].map(([k, v]) => [k, v.balance, v.progress]),
    ]);
    const clean = memoryStore(10);
    await run(clean, async () => {});
    const expected = snapshot(clean);

    let allMatch = true;
    for (let crashAt = 1; crashAt <= 12; crashAt++) {
        const mem = memoryStore(10);
        const milestones = new Set<string>();
        const onMilestone = async (g: string, u: string, m: number) => { milestones.add(jobIds.staffMilestone(g, u, m)); };
        mem.failNext(crashAt);
        try { await run(mem, onMilestone); } catch { /* the simulated crash */ }
        mem.failNext(-1);
        await run(mem, onMilestone);
        if (snapshot(mem) !== expected || milestones.size !== 2) {
            allMatch = false;
            console.log(`  crash at write ${crashAt}: ${snapshot(mem)} vs ${expected} (${milestones.size} milestones)`);
        }
    }
    check("crash anywhere + retry = exactly one apply (counts, periods, points, milestones)", allMatch);
})();

// ── Flush processor (Redis side faked) ────────────────────────────────────────────────────────
await (async () => {
    const mem = memoryStore(10);
    let inflight: string | null = null;
    let pending: BufferedBatch | null = { counts: { [`2026-10-05|${G}|${U}`]: "12" }, last: {}, names: {} };
    const batches = new Map<string, BufferedBatch>();
    const finished: string[] = [];
    let crash = true;

    const deps = {
        take: async (id: string) => {
            if (inflight) return inflight;
            if (!pending) return null;
            batches.set(id, pending); pending = null; inflight = id;
            return id;
        },
        read: async (id: string) => batches.get(id)!,
        finish: async (id: string) => { batches.delete(id); if (inflight === id) inflight = null; finished.push(id); },
        apply: async (id: string, members: readonly MemberBatch[], d: { onMilestone: (g: string, u: string, m: number) => Promise<void> }) => {
            if (crash) { crash = false; throw new Error("worker died mid-flush"); }
            return applyMessageBatch(id, members, { ...d, store: mem.store });
        },
        milestone: async () => {},
    };

    let threw = false;
    try { await processMessageFlush(deps as never); } catch { threw = true; }
    const stuck = inflight;
    check("flush: a failed apply leaves the batch in flight", threw && stuck !== null && batches.has(stuck!));

    pending = { counts: { [`2026-10-05|${G}|${U}`]: "3" }, last: {}, names: {} }; // new messages meanwhile
    const r1 = await processMessageFlush(deps as never);
    check("flush: the next run resumes the same batch, not the new messages", r1?.batchId === stuck && r1?.messages === 12);
    const r2 = await processMessageFlush(deps as never);
    check("flush: then the new messages go in their own batch", r2 !== null && r2.batchId !== stuck && r2.messages === 3);
    check("flush: totals = every message once", mem.activity.get(`${G}|${U}`)!.count === 15 && finished.length === 2);
    check("flush: nothing buffered → no-op", (await processMessageFlush(deps as never)) === null);
})();

// ── Staff-points processor ────────────────────────────────────────────────────────────────────
await (async () => {
    const job = { guildId: G, memberId: U, milestone: 300, requestId: "r" };
    const sent: unknown[] = [];
    const ok = await processStaffPointJob(job, async (...a) => { sent.push(a); return "sent"; });
    check("staff: sends guild, member and milestone", ok === "sent" && JSON.stringify(sent[0]) === JSON.stringify([G, U, 300]));
    check("staff: not staff (404) is a final success", (await processStaffPointJob(job, async () => "not-staff")) === "not-staff");

    const kind = async (send: () => Promise<never>) => {
        try { await processStaffPointJob(job, send); return "ok"; } catch (err) { return err instanceof UnrecoverableError ? "permanent" : "retry"; }
    };
    check("staff: 4xx rejection fails permanently", (await kind(async () => { throw new StaffApiRejected(422, "bad type"); })) === "permanent");
    check("staff: 5xx / timeout is retried", (await kind(async () => { throw new Error("staff API 503"); })) === "retry");
    let invalid = false;
    try { await processStaffPointJob({ ...job, memberId: "nope" }, async () => "sent"); } catch (err) { invalid = err instanceof UnrecoverableError; }
    check("staff: invalid ids fail permanently", invalid);
})();

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll activity flush checks passed.");
