import { writeFile } from "node:fs/promises";
import { Worker, type Job, type WorkerOptions } from "bullmq";
import mongoose from "mongoose";
import { connectDatabase } from "@database/connection";
import { processInviteJoin, processInviteLeave } from "@core/invites";
import { applyMessageXp, applyVoiceXp } from "@core/xp";
import { isStaffMessagePointsEnabled } from "@core/staff-api";
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
    recordJobOrigin,
    redisConnection,
    reportGatewayConflict,
    setComboPartners,
    type ActivityFlushJob,
    type ComboMessageJob,
    type InviteJob,
    type MessageXpJob,
    type StaffPointJob,
    type VoiceTickJob,
} from "@queue";
import { processInvitesJob } from "./processors/invites";
import { defaultActivityDeps, processMessageFlush } from "./processors/activity";
import { processStaffPointJob } from "./processors/staff-points";
import { processXpJob } from "./processors/xp";
import { processComboJob } from "./processors/combo";
import { processVoiceJob } from "./processors/voice";

const SERVICE = "worker";

if (!process.env.MONGODB_URI) {
    Logger.error("MONGODB_URI is not set", SERVICE);
    process.exit(1);
}

/** One Mongo pool for the whole process — never a connection per job. */
await connectDatabase(process.env.MONGODB_URI);

const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY) || 10);

/**
 * Several worker containers run side by side. If one dies mid-job, its job lock expires (30s) and
 * another container picks the job up — every processor is safe to re-run. A job is only given up
 * after stalling 3 times (a job that keeps killing its worker).
 */
const WORKER_OPTIONS: Pick<WorkerOptions, "connection" | "maxStalledCount"> = { connection: redisConnection(), maxStalledCount: 3 };
/** Calls to external APIs (the staff API) in flight at once, per worker. */
const externalConcurrency = Math.max(1, Number(process.env.EXTERNAL_API_CONCURRENCY) || 5);
/** How often buffered message counts are written to MongoDB. */
const flushEvery = Math.max(5_000, Number(process.env.ACTIVITY_FLUSH_MS) || 30_000);

/** Queues that must run one job at a time everywhere (e.g. invites: join before leave) — enforced in Redis, so it holds across replicas. */
for (const [queue, limit] of Object.entries(GLOBAL_CONCURRENCY)) {
    await getQueue(queue as keyof typeof GLOBAL_CONCURRENCY).setGlobalConcurrency(limit!);
}

/**
 * Split-brain watch: jobs carry the Gateway that queued them. Jobs from two Gateways interleaving
 * means both are logged in to Discord — recorded for the leader, which logs the other one out.
 */
function watchOrigin(job: Job<unknown>): void {
    const origin = (job.data as { origin?: unknown } | null)?.origin;
    if (typeof origin !== "string") return;
    void recordJobOrigin(origin, job.timestamp)
        .then(other => {
            if (!other) return;
            Logger.error(`SPLIT BRAIN: jobs from two Gateways at once — ${origin} and ${other}`, SERVICE);
            return reportGatewayConflict(origin, other, "worker");
        })
        .catch(() => {});
}

function logged<T>(queue: string, run: (job: Job<T>) => Promise<unknown>) {
    return async (job: Job<T>) => {
        watchOrigin(job as Job<unknown>);
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
        { ...WORKER_OPTIONS, concurrency },
    ),
    new Worker<ActivityFlushJob>(
        QUEUES.activity,
        logged<ActivityFlushJob>(QUEUES.activity, async () => {
            const outcome = await processMessageFlush({
                ...defaultActivityDeps,
                milestone: async (guildId, memberId, milestone) => {
                    if (!(await isStaffMessagePointsEnabled(guildId))) return; // turned off in that server
                    await enqueue(
                        QUEUES.staffPoints,
                        "milestone",
                        { guildId, memberId, milestone, requestId: newRequestId() },
                        jobIds.staffMilestone(guildId, memberId, milestone),
                    );
                },
            });
            if (outcome) {
                Logger.info(`Flushed batch ${outcome.batchId}: ${outcome.messages} messages from ${outcome.members} members, ${outcome.pointsPaid} points, ${outcome.milestones} staff milestones`, SERVICE);
            }
            return outcome;
        }),
        { ...WORKER_OPTIONS, concurrency: 1 },
    ),
    new Worker<StaffPointJob>(
        QUEUES.staffPoints,
        logged<StaffPointJob>(QUEUES.staffPoints, job => processStaffPointJob(job.data)),
        { ...WORKER_OPTIONS, concurrency: externalConcurrency },
    ),
    new Worker<MessageXpJob>(
        QUEUES.xp,
        logged<MessageXpJob>(QUEUES.xp, job => processXpJob(job.data, {
            apply: applyMessageXp,
            outbox: (outbox, jobId) => enqueue(QUEUES.discordOutbox, outbox.kind, outbox, jobId),
        })),
        { ...WORKER_OPTIONS, concurrency },
    ),
    new Worker<ComboMessageJob>(
        QUEUES.combo,
        logged<ComboMessageJob>(QUEUES.combo, job => processComboJob(job.data, {
            apply: applyComboMessage,
            cachePartners: (guildId, a, b, score) => setComboPartners(guildId, a, b, score, COMBO_CONFIG.expireMs),
        })),
        // One at a time everywhere (global concurrency) — a pair's messages must apply in order.
        { ...WORKER_OPTIONS, concurrency: 1 },
    ),
    new Worker<VoiceTickJob>(
        QUEUES.voice,
        logged<VoiceTickJob>(QUEUES.voice, job => processVoiceJob(job.data, {
            apply: applyVoiceXp,
            outbox: (outbox, jobId) => enqueue(QUEUES.discordOutbox, outbox.kind, outbox, jobId),
        })),
        { ...WORKER_OPTIONS, concurrency },
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

/** Docker's healthcheck reads this file's age: fresh while MongoDB is connected and every consumer runs. */
const beat = () => {
    if (mongoose.connection.readyState === 1 && workers.every(w => w.isRunning())) {
        void writeFile("/tmp/worker-health", String(Date.now())).catch(() => {});
    }
};
beat();
const heartbeat = setInterval(beat, 15_000);

// Stop taking jobs and let running ones finish, then close Redis and Mongo.
onShutdown("workers", () => { clearInterval(heartbeat); return Promise.all(workers.map(w => w.close())); });
onShutdown("queues", () => closeQueues());
onShutdown("redis", () => closeRedis());
onShutdown("mongo", () => mongoose.disconnect());

Logger.success(`Worker consuming ${workers.map(w => w.name).join(", ")} (concurrency ${concurrency})`, SERVICE);
