import { UnrecoverableError } from "bullmq";
import { applyVoiceXp, type VoiceXpOutcome } from "@core/xp";
import { jobIds, type DiscordOutboxJob, type VoiceTickJob } from "@queue";

/**
 * The `voice` queue: one guild's voice tick. Applies each member's XP (`@core/xp`, exactly once per
 * member per tick — a retried tick re-runs everyone safely) and sends voice level-ups to the
 * Gateway through the outbox (level roles, then the announcement).
 */

export interface VoiceProcessorDeps {
    apply: typeof applyVoiceXp;
    outbox: (job: DiscordOutboxJob, jobId: string) => Promise<void>;
}

const SNOWFLAKE = /^\d{17,20}$/;

function validate(job: VoiceTickJob): void {
    if (job?.kind !== "voice-tick") throw new UnrecoverableError("unknown voice job kind");
    if (!SNOWFLAKE.test(job.guildId)) throw new UnrecoverableError("invalid guild id");
    if (!Number.isSafeInteger(job.tickAt) || job.tickAt <= 0) throw new UnrecoverableError("invalid tick time");
    if (!Array.isArray(job.members)) throw new UnrecoverableError("invalid member list");
    for (const m of job.members) {
        if (!SNOWFLAKE.test(m.memberId)) throw new UnrecoverableError("invalid member id");
        if (!Number.isInteger(m.xp) || m.xp <= 0 || m.xp > 1_000) throw new UnrecoverableError("invalid xp amount");
        if (!(m.seconds > 0 && m.seconds <= 3_600)) throw new UnrecoverableError("invalid seconds");
    }
}

export async function processVoiceJob(job: VoiceTickJob, deps: VoiceProcessorDeps): Promise<{ members: number; levelUps: number }> {
    validate(job);

    let levelUps = 0;
    for (const m of job.members) {
        const outcome: VoiceXpOutcome = await deps.apply({
            guildId: job.guildId,
            memberId: m.memberId,
            username: m.username,
            xp: m.xp,
            seconds: m.seconds,
            at: new Date(job.tickAt),
            tickKey: `${job.guildId}-${job.tickAt}`,
        });
        if (outcome.status !== "applied" || !outcome.leveledUp) continue;

        levelUps++;
        await deps.outbox(
            {
                kind: "level-up",
                guildId: job.guildId,
                memberId: m.memberId,
                xpKind: "voice",
                level: outcome.newLevel,
                levels: { messageLevel: outcome.messageLevel, voiceLevel: outcome.newLevel },
                requestId: job.requestId,
            },
            jobIds.levelUp(job.guildId, m.memberId, "voice", outcome.newLevel),
        );
    }

    return { members: job.members.length, levelUps };
}
