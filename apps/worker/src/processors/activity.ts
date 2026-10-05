import { randomBytes } from "node:crypto";
import { applyMessageBatch, groupMessageBatch, type FlushOutcome } from "@core/activity";
import { finishMessageBatch, readMessageBatch, takeMessageBatch } from "@queue";

/**
 * The `activity` queue: flushes the buffered message counts to MongoDB. Scheduled every
 * `ACTIVITY_FLUSH_MS` by the worker; the queue runs one flush at a time everywhere.
 *
 * Crash-safe: the batch stays in Redis (and `inflight` keeps naming it) until every write is
 * applied, so a failed flush is retried — by this job's retry or simply the next tick — on the
 * same batch, and the batch-guarded writes skip whatever was already done.
 */

export interface ActivityProcessorDeps {
    take: typeof takeMessageBatch;
    read: typeof readMessageBatch;
    finish: typeof finishMessageBatch;
    apply: typeof applyMessageBatch;
    milestone: (guildId: string, memberId: string, milestone: number) => Promise<void>;
}

export const defaultActivityDeps: Omit<ActivityProcessorDeps, "milestone"> = {
    take: takeMessageBatch,
    read: readMessageBatch,
    finish: finishMessageBatch,
    apply: applyMessageBatch,
};

/** Unique per flush, never reused — not even after a Redis reset. No `:` (it's part of key names). */
export function newBatchId(): string {
    return `${Date.now()}-${randomBytes(4).toString("hex")}`;
}

export async function processMessageFlush(deps: ActivityProcessorDeps): Promise<(FlushOutcome & { batchId: string }) | null> {
    const batchId = await deps.take(newBatchId());
    if (!batchId) return null;

    const members = groupMessageBatch(await deps.read(batchId));
    const outcome = await deps.apply(batchId, members, { onMilestone: deps.milestone });
    await deps.finish(batchId);
    return { ...outcome, batchId };
}
