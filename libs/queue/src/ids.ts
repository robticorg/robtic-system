import { randomBytes } from "node:crypto";

/**
 * Deterministic job ids — the same event always produces the same id, so enqueuing it twice
 * (a gateway replay, a retried handler) keeps one job. `_` separators: BullMQ forbids `:`.
 */
export const jobIds = {
    inviteJoin: (guildId: string, memberId: string, joinedAt: Date) => `invite-join_${guildId}_${memberId}_${joinedAt.getTime()}`,
    inviteLeave: (guildId: string, memberId: string, leftAt: Date) => `invite-leave_${guildId}_${memberId}_${leftAt.getTime()}`,
    inviteJoinAnnouncement: (guildId: string, memberId: string, joinedAt: string) => `announce-join_${guildId}_${memberId}_${Date.parse(joinedAt)}`,
    inviteLeaveAnnouncement: (guildId: string, memberId: string, leftAt: string) => `announce-leave_${guildId}_${memberId}_${Date.parse(leftAt)}`,
    /** One per milestone ever — the same hundred messages can't queue a second staff point. */
    staffMilestone: (guildId: string, memberId: string, milestone: number) => `staff-msg_${guildId}_${memberId}_${milestone}`,
    /** Message ids are unique per channel and globally in practice (snowflakes). */
    messageXp: (guildId: string, messageId: string) => `xp_${guildId}_${messageId}`,
    xpGainLog: (guildId: string, messageId: string) => `xp-log_${guildId}_${messageId}`,
    comboMessage: (guildId: string, messageId: string) => `combo_${guildId}_${messageId}`,
    /** One announcement per level reached — a retry, or two gains racing, can't announce it twice. */
    levelUp: (guildId: string, memberId: string, kind: "message" | "voice", level: number) => `level-up_${guildId}_${memberId}_${kind}_${level}`,
} as const;

/** A short correlation id for one Discord event / request, carried through APIs, queues and workers. */
export function newRequestId(): string {
    return randomBytes(6).toString("hex");
}
