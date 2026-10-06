import { UnrecoverableError } from "bullmq";
import { applyMessageXp, type MessageXpOutcome } from "@core/xp";
import { jobIds, type DiscordOutboxJob, type MessageXpJob } from "@queue";

/**
 * The `xp` queue: chat XP for one message. Applies it (`@core/xp`, exactly once per job), then asks
 * the Gateway — through the outbox — to log the gain and, on a level-up, to give the level roles
 * and announce it. Outbox job ids come from the message / level, so a retry can't post twice.
 */

export interface XpProcessorDeps {
    apply: typeof applyMessageXp;
    outbox: (job: DiscordOutboxJob, jobId: string) => Promise<void>;
}

const SNOWFLAKE = /^\d{17,20}$/;

function validate(job: MessageXpJob): void {
    if (job?.kind !== "message-xp") throw new UnrecoverableError("unknown xp job kind");
    if (![job.guildId, job.memberId, job.messageId].every(id => SNOWFLAKE.test(id))) throw new UnrecoverableError("invalid guild, member or message id");
    if (!Number.isInteger(job.xp) || job.xp <= 0 || job.xp > 1_000) throw new UnrecoverableError("invalid xp amount");
    if (!Number.isFinite(Date.parse(job.at))) throw new UnrecoverableError("invalid timestamp");
}

export async function processXpJob(job: MessageXpJob, deps: XpProcessorDeps): Promise<MessageXpOutcome> {
    validate(job);

    const outcome = await deps.apply({
        guildId: job.guildId,
        memberId: job.memberId,
        username: job.username,
        messageId: job.messageId,
        xp: job.xp,
        at: new Date(job.at),
    });
    if (outcome.status !== "applied") return outcome;

    if (outcome.leveledUp) {
        await deps.outbox(
            {
                kind: "level-up",
                guildId: job.guildId,
                memberId: job.memberId,
                xpKind: "message",
                level: outcome.newLevel,
                levels: { messageLevel: outcome.newLevel, voiceLevel: outcome.voiceLevel },
                requestId: job.requestId,
            },
            jobIds.levelUp(job.guildId, job.memberId, "message", outcome.newLevel),
        );
    }

    await deps.outbox(
        {
            kind: "xp-gain-log",
            guildId: job.guildId,
            memberId: job.memberId,
            username: job.username,
            xp: job.xp,
            leveledUp: outcome.leveledUp,
            level: outcome.newLevel,
            requestId: job.requestId,
        },
        jobIds.xpGainLog(job.guildId, job.messageId),
    );

    return outcome;
}
