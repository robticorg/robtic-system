import { Worker, type Job } from "bullmq";
import mongoose from "mongoose";
import { connectDatabase } from "@database/connection";
import { processInviteJoin, processInviteLeave } from "@core/invites";
import { applyMessageXp } from "@core/xp";
import { applyComboMessage } from "@core/combo";
import { COMBO_CONFIG } from "@constants";
import { onShutdown } from "@internal-api";
import { Logger } from "@logger";
import {
    GLOBAL_CONCURRENCY,
    QUEUES,
    closeQueues,
    closeRedis,
    enqueue,
    getQueue,
    jobIds,
    newRequestId,
    redisConnection,
    setComboPartners,
    type ActivityFlushJob,
    type ComboMessageJob,
    type InviteJob,
    type MessageXpJob,
    type StaffPointJob,
} from "@queue";
import { processInvitesJob } from "./processors/invites";
import { defaultActivityDeps, processMessageFlush } from "./processors/activity";
import { processStaffPointJob } from "./processors/staff-points";
import { processXpJob } from "./processors/xp";
import { processComboJob } from "./processors/combo";

const SERVICE = "worker";

if (!process.env.MONGODB_URI) {
    Logger.error("MONGODB_URI is not set", SERVICE);
    process.exit(1);
}

/** One Mongo pool for the whole process — never a connection per job. */
await connectDatabase(process.env.MONGODB_URI);

const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY) || 10);
/** Calls to external APIs (the staff API) in flight at once, per worker. */
const externalConcurrency = Math.max(1, Number(process.env.EXTERNAL_API_CONCURRENCY) || 5);
/** How often buffered message counts are written to MongoDB. */
const flushEvery = Math.max(5_000, Number(process.env.ACTIVITY_FLUSH_MS) || 30_000);

/** Queues that must run one job at a time everywhere (e.g. invites: join before leave) — enforced in Redis, so it holds across replicas. */
for (const [queue, limit] of Object.entries(GLOBAL_CONCURRENCY)) {
    await getQueue(queue as keyof typeof GLOBAL_CONCURRENCY).setGlobalConcurrency(limit!);
}

function logged<T>(queue: string, run: (job: Job<T>) => Promise<unknown>) {
    return async (job: Job<T>) => {
        const started = performance.now();
        const meta = job.data as { requestId?: string; guildId?: string; memberId?: string };
        const context = `queue=${queue} job=${job.name} jobId=${job.id} requestId=${meta.requestId ?? "-"} guildId=${meta.guildId ?? "-"} userId=${meta.memberId ?? "-"} attempt=${job.attemptsMade + 1}`;
        try {
            const result = await run(job);
            Logger.debug(`${context} done in ${Math.round(performance.now() - started)}ms`, SERVICE);
            return result;
        } catch (err) {
            Logger.warn(`${context} failed in ${Math.round(performance.now() - started)}ms: ${(err as Error).message}`, SERVICE);
            throw err;
        }
    };
}

const workers = [
    new Worker<InviteJob>(
        QUEUES.invites,
        logged<InviteJob>(QUEUES.invites, job => processInvitesJob(job.data, {
            join: processInviteJoin,
            leave: processInviteLeave,
            announce: (outbox, jobId) => enqueue(QUEUES.discordOutbox, outbox.kind, outbox, jobId),
        })),
        { connection: redisConnection(), concurrency },
    ),
    new Worker<ActivityFlushJob>(
        QUEUES.activity,
        logged<ActivityFlushJob>(QUEUES.activity, async () => {
            const outcome = await processMessageFlush({
                ...defaultActivityDeps,
                milestone: (guildId, memberId, milestone) => enqueue(
                    QUEUES.staffPoints,
                    "milestone",
                    { guildId, memberId, milestone, requestId: newRequestId() },
                    jobIds.staffMilestone(guildId, memberId, milestone),
                ),
            });
            if (outcome) {
                Logger.info(`Flushed batch ${outcome.batchId}: ${outcome.messages} messages from ${outcome.members} members, ${outcome.pointsPaid} points, ${outcome.milestones} staff milestones`, SERVICE);
            }
            return outcome;
        }),
        { connection: redisConnection(), concurrency: 1 },
    ),
    new Worker<StaffPointJob>(
        QUEUES.staffPoints,
        logged<StaffPointJob>(QUEUES.staffPoints, job => processStaffPointJob(job.data)),
        { connection: redisConnection(), concurrency: externalConcurrency },
    ),
    new Worker<MessageXpJob>(
        QUEUES.xp,
        logged<MessageXpJob>(QUEUES.xp, job => processXpJob(job.data, {
            apply: applyMessageXp,
            outbox: (outbox, jobId) => enqueue(QUEUES.discordOutbox, outbox.kind, outbox, jobId),
        })),
        { connection: redisConnection(), concurrency },
    ),
    new Worker<ComboMessageJob>(
        QUEUES.combo,
        logged<ComboMessageJob>(QUEUES.combo, job => processComboJob(job.data, {
            apply: applyComboMessage,
            cachePartners: (guildId, a, b, score) => setComboPartners(guildId, a, b, score, COMBO_CONFIG.expireMs),
        })),
        // One at a time everywhere (global concurrency) — a pair's messages must apply in order.
        { connection: redisConnection(), concurrency: 1 },
    ),
];

/** The flush tick. Upserting the scheduler is idempotent, so every replica can do it on boot. */
await getQueue(QUEUES.activity).upsertJobScheduler(
    "message-flush",
    { every: flushEvery },
    { name: "flush", data: { kind: "message-flush" }, opts: { attempts: 3, backoff: { type: "exponential", delay: 2_000 } } },
);

for (const worker of workers) {
    worker.on("error", err => Logger.error(`Worker ${worker.name} error: ${err.message}`, SERVICE));
}

// Stop taking jobs and let running ones finish, then close Redis and Mongo.
onShutdown("workers", () => Promise.all(workers.map(w => w.close())));
onShutdown("queues", () => closeQueues());
onShutdown("redis", () => closeRedis());
onShutdown("mongo", () => mongoose.disconnect());

Logger.success(`Worker consuming ${workers.map(w => w.name).join(", ")} (concurrency ${concurrency})`, SERVICE);
