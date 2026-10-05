import { COMBO_LEADERBOARD_PERIODS, type ComboLeaderboardPeriod } from "@constants";
import { ActivityRepository, PeriodicStatRepository, PointsRepository } from "@database/repositories";
import { periodKeyFor } from "@utils";
import { crossedMilestones } from "../staff-api";
import { getPointRates } from "../points/get-point-rates";

/**
 * The real-message counter, batched.
 *
 * The Gateway no longer writes MongoDB for every message: it increments a Redis hash
 * (`@queue` message buffer), and the worker flushes it every few seconds through
 * `applyMessageBatch`. One flush = one batch with a unique id. Each person's counts are applied
 * **exactly once** per batch — every write is guarded by the batch id — so a flush that crashes
 * half-way and is retried changes nothing it already changed.
 *
 * What a batch updates, per person: `realMessageCount` + the message-decay clock, the four
 * `messages` period buckets, and message progress → Points. Staff-point milestones crossed by the
 * new count are handed to the caller (they go to an external API, through their own queue).
 */

/** Hash field for a buffered count: the UTC day it happened, guild, member. */
export function messageBufferField(at: Date, guildId: string, discordId: string): string {
    return `${at.toISOString().slice(0, 10)}|${guildId}|${discordId}`;
}

export interface BufferedBatch {
    /** `day|guild|member` → messages. */
    counts: Record<string, string>;
    /** `guild|member` → last message time (ms). */
    last: Record<string, string>;
    /** `guild|member` → username. */
    names: Record<string, string>;
}

export interface MemberBatch {
    guildId: string;
    discordId: string;
    username: string;
    total: number;
    lastActiveAt: Date;
    /** `period|periodKey` → messages, summed across the batch's days. */
    periods: Map<string, number>;
}

/**
 * Groups a raw batch by member. Days map to their own period buckets, so a batch that spans
 * midnight (or a week/month boundary) still lands each message in the right day/week/month —
 * and two days of one batch that share a bucket (same week) are summed into one guarded write.
 */
export function groupMessageBatch(batch: BufferedBatch): MemberBatch[] {
    const members = new Map<string, MemberBatch>();

    for (const [field, raw] of Object.entries(batch.counts)) {
        const [day, guildId, discordId] = field.split("|");
        const count = Number(raw);
        if (!day || !guildId || !discordId || !Number.isInteger(count) || count <= 0) continue;
        const date = new Date(`${day}T00:00:00.000Z`);
        if (Number.isNaN(date.getTime())) continue;

        const key = `${guildId}|${discordId}`;
        let member = members.get(key);
        if (!member) {
            const lastMs = Number(batch.last[key]);
            member = {
                guildId,
                discordId,
                username: batch.names[key] || discordId,
                total: 0,
                lastActiveAt: Number.isFinite(lastMs) && lastMs > 0 ? new Date(lastMs) : date,
                periods: new Map(),
            };
            members.set(key, member);
        }

        member.total += count;
        for (const period of COMBO_LEADERBOARD_PERIODS) {
            const bucket = `${period}|${periodKeyFor(period, date)}`;
            member.periods.set(bucket, (member.periods.get(bucket) ?? 0) + count);
        }
    }

    return [...members.values()];
}

/** The writes a flush needs — the repositories in production, in-memory stand-ins in tests. */
export interface MessageCounterStore {
    addRealMessages(m: MemberBatch, batchId: string): Promise<{ total: number; added: number }>;
    addPeriod(m: MemberBatch, period: ComboLeaderboardPeriod, periodKey: string, amount: number, batchId: string): Promise<unknown>;
    addProgress(m: MemberBatch, rate: number, batchId: string): Promise<number>;
    messagesPerPoint(guildId: string): Promise<number>;
}

export const repositoryMessageCounterStore: MessageCounterStore = {
    addRealMessages: (m, batchId) => ActivityRepository.addRealMessagesBatch(m.discordId, m.guildId, m.username, m.total, m.lastActiveAt, batchId),
    addPeriod: (m, period, periodKey, amount, batchId) =>
        PeriodicStatRepository.incrementBatch(m.guildId, period, periodKey, "messages", m.discordId, amount, batchId),
    addProgress: (m, rate, batchId) => PointsRepository.addMessageProgressBatch(m.guildId, m.discordId, m.username, m.total, rate, batchId),
    messagesPerPoint: async guildId => (await getPointRates(guildId)).messagesPerPoint,
};

export interface FlushOutcome {
    members: number;
    messages: number;
    pointsPaid: number;
    milestones: number;
}

/**
 * Applies one batch. Members are processed one after another (a flush is small and this keeps
 * Mongo load flat); any error propagates so the job is retried — and the retry is safe.
 */
export async function applyMessageBatch(
    batchId: string,
    members: readonly MemberBatch[],
    deps: {
        store?: MessageCounterStore;
        /** A staff-point milestone was crossed. Must be idempotent per (guild, member, milestone). */
        onMilestone: (guildId: string, discordId: string, milestone: number) => Promise<void>;
    },
): Promise<FlushOutcome> {
    const store = deps.store ?? repositoryMessageCounterStore;
    const rates = new Map<string, number>();
    const outcome: FlushOutcome = { members: 0, messages: 0, pointsPaid: 0, milestones: 0 };

    for (const m of members) {
        const { total, added } = await store.addRealMessages(m, batchId);
        for (const milestone of crossedMilestones(total, added)) {
            await deps.onMilestone(m.guildId, m.discordId, milestone);
            outcome.milestones++;
        }

        for (const [bucket, amount] of m.periods) {
            const [period, periodKey] = bucket.split("|") as [ComboLeaderboardPeriod, string];
            await store.addPeriod(m, period, periodKey, amount, batchId);
        }

        if (!rates.has(m.guildId)) rates.set(m.guildId, await store.messagesPerPoint(m.guildId));
        outcome.pointsPaid += await store.addProgress(m, rates.get(m.guildId)!, batchId);

        outcome.members++;
        outcome.messages += m.total;
    }

    return outcome;
}
