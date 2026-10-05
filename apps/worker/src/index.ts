import { Worker, type Job } from "bullmq";
import mongoose from "mongoose";
import { connectDatabase } from "@database/connection";
import { processInviteJoin, processInviteLeave } from "@core/invites";
import { onShutdown } from "@internal-api";
import { Logger } from "@logger";
import { GLOBAL_CONCURRENCY, QUEUES, closeQueues, enqueue, getQueue, redisConnection, type InviteJob } from "@queue";
import { processInvitesJob } from "./processors/invites";

const SERVICE = "worker";

if (!process.env.MONGODB_URI) {
    Logger.error("MONGODB_URI is not set", SERVICE);
    process.exit(1);
}

/** One Mongo pool for the whole process — never a connection per job. */
await connectDatabase(process.env.MONGODB_URI);

const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY) || 10);

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
];

for (const worker of workers) {
    worker.on("error", err => Logger.error(`Worker ${worker.name} error: ${err.message}`, SERVICE));
}

// Stop taking jobs and let running ones finish, then close Redis and Mongo.
onShutdown("workers", () => Promise.all(workers.map(w => w.close())));
onShutdown("queues", () => closeQueues());
onShutdown("mongo", () => mongoose.disconnect());

Logger.success(`Worker consuming ${workers.map(w => w.name).join(", ")} (concurrency ${concurrency})`, SERVICE);
