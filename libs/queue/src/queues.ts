import { Queue, type JobsOptions } from "bullmq";
import { redisConnection } from "./connection";
import type { JobPayloads, QueueName } from "./types";

/**
 * Every queue, by name. One list, so no service spells a queue name on its own.
 *
 * - `invites`: member joins/leaves → invite history + reward credits. **Global concurrency 1**:
 *   a join and the leave that follows it must apply in order, across every worker replica.
 * - `discord-outbox`: things that must be posted in Discord. Consumed by the Gateway, the only
 *   process with a Discord connection — workers enqueue here instead of talking to Discord.
 * - `activity`: the message-counter flush. **Global concurrency 1**: one batch at a time, so a
 *   batch is always finished (or resumed) before the next one is taken.
 * - `staff-points`: milestone points sent to the external staff API, at a bounded concurrency
 *   (`EXTERNAL_API_CONCURRENCY`) so a burst can't flood it.
 */
export const QUEUES = {
    invites: "invites",
    discordOutbox: "discord-outbox",
    activity: "activity",
    staffPoints: "staff-points",
} as const satisfies Record<string, QueueName>;

/** Queues whose jobs must run one at a time, everywhere. */
export const GLOBAL_CONCURRENCY: Partial<Record<QueueName, number>> = {
    invites: 1,
    activity: 1,
};

/**
 * Retry policy: transient failures (Mongo, Redis, network) retry with exponential backoff —
 * 1s, 2s, 4s, 8s, 16s — then the job stays in the failed set for inspection. A permanent failure
 * throws `UnrecoverableError` and is not retried. Finished jobs are trimmed, failed ones kept.
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
    attempts: 6,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: { age: 24 * 3600, count: 5_000 },
    removeOnFail: { age: 7 * 24 * 3600 },
};

const queues = new Map<QueueName, Queue>();

/** The process-wide producer for a queue — one Redis connection per queue, reused. */
export function getQueue<N extends QueueName>(name: N): Queue<JobPayloads[N]> {
    let queue = queues.get(name);
    if (!queue) {
        queue = new Queue(name, { connection: redisConnection(), defaultJobOptions: DEFAULT_JOB_OPTIONS });
        queues.set(name, queue);
    }
    return queue as Queue<JobPayloads[N]>;
}

/**
 * Adds a job. `jobId` makes it idempotent at the queue level: adding the same id twice keeps one
 * job, so a retried Discord event can't double-enqueue. Ids may not contain `:` (a BullMQ rule).
 */
export async function enqueue<N extends QueueName>(
    name: N,
    jobName: string,
    data: JobPayloads[N],
    jobId: string,
    options: JobsOptions = {},
): Promise<void> {
    if (jobId.includes(":")) throw new Error(`Job id may not contain ":" — got ${jobId}`);
    await getQueue(name).add(jobName as never, data as never, { ...options, jobId });
}

/** Closes every producer — part of graceful shutdown. */
export async function closeQueues(): Promise<void> {
    await Promise.allSettled([...queues.values()].map(q => q.close()));
    queues.clear();
}
