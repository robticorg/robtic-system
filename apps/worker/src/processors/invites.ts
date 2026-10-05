import { UnrecoverableError } from "bullmq";
import { jobIds, type DiscordOutboxJob, type InviteJob } from "@queue";
import { processInviteJoin, processInviteLeave, type InviteJoinOutcome } from "@core/invites";

/**
 * The `invites` queue: a member joined or left. Writes the invite history and reward credits
 * (`@core/invites`), then asks the Gateway — through the `discord-outbox` queue — to announce it.
 *
 * Safe to retry at any point: the writes are idempotent (see `@core/invites`), and the
 * announcement's job id is derived from the event, so a retry can't post it twice.
 */

export interface InvitesProcessorDeps {
    join: typeof processInviteJoin;
    leave: typeof processInviteLeave;
    announce: (job: DiscordOutboxJob, jobId: string) => Promise<void>;
}

const SNOWFLAKE = /^\d{17,20}$/;

/** Bad data will never succeed — fail it permanently instead of retrying. */
function validate(job: InviteJob): void {
    if (!job || (job.kind !== "join" && job.kind !== "leave")) throw new UnrecoverableError("unknown invite job kind");
    if (!SNOWFLAKE.test(job.guildId) || !SNOWFLAKE.test(job.memberId)) throw new UnrecoverableError("invalid guild or member id");
    const at = job.kind === "join" ? job.joinedAt : job.leftAt;
    if (!Number.isFinite(Date.parse(at))) throw new UnrecoverableError("invalid timestamp");
}

export async function processInvitesJob(job: InviteJob, deps: InvitesProcessorDeps): Promise<InviteJoinOutcome | { closed: boolean }> {
    validate(job);

    if (job.kind === "join") {
        const outcome = await deps.join({
            guildId: job.guildId,
            memberId: job.memberId,
            joinedAt: new Date(job.joinedAt),
            used: job.used,
        });
        // A repeat of a join that was already recorded (and announced) — nothing new to say.
        if (outcome.recorded) {
            await deps.announce(
                { kind: "invite-join-announcement", guildId: job.guildId, memberId: job.memberId, used: job.used, requestId: job.requestId },
                jobIds.inviteJoinAnnouncement(job.guildId, job.memberId, job.joinedAt),
            );
        }
        return outcome;
    }

    const joined = await deps.leave({ guildId: job.guildId, memberId: job.memberId, leftAt: new Date(job.leftAt) });
    await deps.announce(
        {
            kind: "invite-leave-announcement",
            guildId: job.guildId,
            memberId: job.memberId,
            memberName: job.memberName,
            source: joined?.source ?? "unknown",
            inviterId: joined?.inviterId ?? null,
            requestId: job.requestId,
        },
        jobIds.inviteLeaveAnnouncement(job.guildId, job.memberId, job.leftAt),
    );
    return { closed: joined !== null };
}
