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
    })
    /** A message/voice level went up: give the level roles now earned, then announce it. */
    | (JobMeta & {
        kind: "level-up";
        guildId: string;
        memberId: string;
        xpKind: "message" | "voice";
        level: number;
        levels: { messageLevel: number; voiceLevel: number };
    })
    /** One XP gain, for the `xp_gain` activity-log channel. */
    | (JobMeta & {
        kind: "xp-gain-log";
        guildId: string;
        memberId: string;
        username: string;
        xp: number;
        leveledUp: boolean;
        level: number;
    });

/** The periodic message-counter flush (scheduled by the worker, never enqueued by hand). */
export interface ActivityFlushJob {
    kind: "message-flush";
}

/** One staff point for a message milestone, sent to the external staff API. */
export interface StaffPointJob extends JobMeta {
    guildId: string;
    memberId: string;
    milestone: number;
}

/**
 * Chat XP for one message. The Gateway already decided it counts (role, channel, cooldown, not
 * spam) and rolled the amount, so a retry grants exactly the same XP.
 */
export interface MessageXpJob extends JobMeta {
    kind: "message-xp";
    guildId: string;
    memberId: string;
    username: string;
    messageId: string;
    xp: number;
    at: string;
}

/**
 * One conversational message for the combo system. The Gateway detected the partner and measured
 * the message (the content itself never goes into Redis).
 */
export interface ComboMessageJob extends JobMeta {
    kind: "combo-message";
    guildId: string;
    authorId: string;
    partnerId: string;
    username: string;
    messageId: string;
    confidence: number;
    at: string;
    countable: boolean;
    wordCount: number;
    characterCount: number;
}

/**
 * One guild's voice tick: every member the Gateway found eligible this minute (it owns the voice
 * states, AFK and alone rules), with the XP already rolled so a retry grants the same amounts.
 */
export interface VoiceTickJob extends JobMeta {
    kind: "voice-tick";
    guildId: string;
    /** The tick's time (ms) — one per guild per minute, the job's and every write's key. */
    tickAt: number;
    members: Array<{ memberId: string; username: string; xp: number; seconds: number }>;
}

export interface JobPayloads {
    invites: InviteJob;
    "discord-outbox": DiscordOutboxJob;
    activity: ActivityFlushJob;
    "staff-points": StaffPointJob;
    xp: MessageXpJob;
    combo: ComboMessageJob;
    voice: VoiceTickJob;
}

export type QueueName = keyof JobPayloads;
