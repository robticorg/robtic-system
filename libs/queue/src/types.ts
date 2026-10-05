/**
 * Job payloads, per queue. Plain JSON only — dates as ISO strings — because jobs go through Redis.
 * Every payload carries `requestId` so one Discord event can be followed through the Gateway, the
 * queue and the worker in the logs.
 */

export interface JobMeta {
    requestId: string;
}

/** The invite the Gateway detected for a join (detection needs its invite cache, so it stays there). */
export interface DetectedInvite {
    code: string;
    inviterId: string | null;
    vanity?: boolean;
    uses: number;
    maxUses: number;
}

export interface InviteJoinJob extends JobMeta {
    kind: "join";
    guildId: string;
    memberId: string;
    joinedAt: string;
    used: DetectedInvite | null;
}

export interface InviteLeaveJob extends JobMeta {
    kind: "leave";
    guildId: string;
    memberId: string;
    memberName: string;
    leftAt: string;
}

export type InviteJob = InviteJoinJob | InviteLeaveJob;

/** Posted by the Gateway; produced by workers. Semantic data — the Gateway owns the wording. */
export type DiscordOutboxJob =
    | (JobMeta & { kind: "invite-join-announcement"; guildId: string; memberId: string; used: DetectedInvite | null })
    | (JobMeta & {
        kind: "invite-leave-announcement";
        guildId: string;
        memberId: string;
        memberName: string;
        source: "invite" | "vanity" | "unknown";
        inviterId: string | null;
    });

export interface JobPayloads {
    invites: InviteJob;
    "discord-outbox": DiscordOutboxJob;
}

export type QueueName = keyof JobPayloads;
