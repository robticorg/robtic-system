import { Worker } from "bullmq";
import type { Client, Guild } from "discord.js";
import { onShutdown } from "@internal-api";
import { Logger } from "@logger";
import { QUEUES, isRedisConfigured, redisConnection, type DiscordOutboxJob } from "@queue";
import { announceJoin } from "@bot/features/invites/functions/announce-join";
import { announceLeave } from "@bot/features/invites/functions/announce-leave";

const CTX = "discord-outbox";

export interface OutboxDeps {
    guild: (guildId: string) => Guild | undefined;
    announceJoin: typeof announceJoin;
    announceLeave: typeof announceLeave;
}

/**
 * One outbox job → one Discord post. Workers have no Discord connection, so anything they need
 * posted comes here; the wording stays in the Gateway. A guild the bot is no longer in is simply
 * done (nothing to retry); a failed post throws, so BullMQ retries it with backoff.
 */
export async function processOutboxJob(job: DiscordOutboxJob, deps: OutboxDeps): Promise<"sent" | "skipped"> {
    const guild = deps.guild(job.guildId);
    if (!guild) return "skipped";

    switch (job.kind) {
        case "invite-join-announcement":
            await deps.announceJoin(guild, job.memberId, job.used, job.requestId);
            return "sent";
        case "invite-leave-announcement":
            await deps.announceLeave(guild, job.memberName, { source: job.source, inviterId: job.inviterId });
            return "sent";
    }
}

/** Starts consuming the outbox once the Gateway is connected. No-op without Redis. */
export function startDiscordOutbox(client: Client): void {
    if (!isRedisConfigured()) {
        Logger.info("REDIS_URL not set — Discord outbox not started (events are processed inline)", CTX);
        return;
    }

    const worker = new Worker<DiscordOutboxJob>(
        QUEUES.discordOutbox,
        async job => {
            const result = await processOutboxJob(job.data, {
                guild: id => client.guilds.cache.get(id),
                announceJoin,
                announceLeave,
            });
            Logger.debug(`queue=${QUEUES.discordOutbox} job=${job.name} jobId=${job.id} requestId=${job.data.requestId} guildId=${job.data.guildId} ${result}`, CTX);
        },
        { connection: redisConnection(), concurrency: Math.max(1, Number(process.env.DISCORD_OUTBOX_CONCURRENCY) || 5) },
    );
    worker.on("failed", (job, err) => Logger.warn(`queue=${QUEUES.discordOutbox} jobId=${job?.id} attempt=${job?.attemptsMade} failed: ${err.message}`, CTX));
    worker.on("error", err => Logger.error(`Outbox worker error: ${err.message}`, CTX));

    onShutdown("discord outbox", () => worker.close());
    Logger.success("Discord outbox consumer started", CTX);
}
