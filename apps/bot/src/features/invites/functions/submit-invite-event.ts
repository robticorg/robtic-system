import type { Guild } from "discord.js";
import { processInviteJoin, processInviteLeave, type DetectedInviteUse } from "@core/invites";
import { Logger } from "@logger";
import { QUEUES, enqueue, isRedisConfigured, jobIds, newRequestId } from "@queue";
import { announceJoin } from "./announce-join";
import { announceLeave } from "./announce-leave";

const CTX = "main/invites";

/**
 * Hands a detected join to the worker through the `invites` queue (job id derived from the event,
 * so a replayed event can't queue it twice). Without Redis — local dev, or before the stack runs
 * it — or if queuing fails, the very same domain code runs inline and announces directly, exactly
 * as before the refactor: an event is never dropped because the queue is unavailable.
 */
export async function submitInviteJoin(guild: Guild, memberId: string, used: (DetectedInviteUse & { uses: number; maxUses: number }) | null, joinedAt: Date): Promise<void> {
    const requestId = newRequestId();

    if (isRedisConfigured()) {
        try {
            await enqueue(QUEUES.invites, "join", {
                kind: "join",
                guildId: guild.id,
                memberId,
                joinedAt: joinedAt.toISOString(),
                used: used ? { code: used.code, inviterId: used.inviterId, vanity: used.vanity, uses: used.uses, maxUses: used.maxUses } : null,
                requestId,
            }, jobIds.inviteJoin(guild.id, memberId, joinedAt));
            return;
        } catch (err) {
            Logger.warn(`requestId=${requestId} queueing a join failed, processing inline: ${(err as Error).message}`, CTX);
        }
    }

    const outcome = await processInviteJoin({ guildId: guild.id, memberId, joinedAt, used });
    if (outcome.recorded) await announceJoin(guild, memberId, used, requestId);
}

export async function submitInviteLeave(guild: Guild, memberId: string, memberName: string, leftAt: Date): Promise<void> {
    const requestId = newRequestId();

    if (isRedisConfigured()) {
        try {
            await enqueue(QUEUES.invites, "leave", {
                kind: "leave",
                guildId: guild.id,
                memberId,
                memberName,
                leftAt: leftAt.toISOString(),
                requestId,
            }, jobIds.inviteLeave(guild.id, memberId, leftAt));
            return;
        } catch (err) {
            Logger.warn(`requestId=${requestId} queueing a leave failed, processing inline: ${(err as Error).message}`, CTX);
        }
    }

    const joined = await processInviteLeave({ guildId: guild.id, memberId, leftAt });
    await announceLeave(guild, memberName, joined);
}
