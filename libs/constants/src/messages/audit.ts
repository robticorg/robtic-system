/** Titles and field labels for the moderation audit embeds. */
export const AUDIT_MESSAGES = {
    memberJoinTitle: "📘 Audit: Member Joined",
    memberLeaveTitle: "📘 Audit: Member Left",
    memberKickTitle: "📘 Audit: Member Kicked",
    memberBanTitle: "📘 Audit: Member Banned",
    messageDeleteTitle: "📘 Audit: Message Deleted",
    channelCreateTitle: "📘 Audit: Channel Created",
    channelDeleteTitle: "📘 Audit: Channel Deleted",
    roleUpdateTitle: "📘 Audit: Member Role Update",

    userFieldName: "User",
    targetFieldName: "Target",
    executorFieldName: "Executor",
    reasonFieldName: "Reason",
    accountCreatedFieldName: "Account Created",
    authorFieldName: "Author",
    channelFieldName: "Channel",
    messageIdFieldName: "Message ID",
    contentFieldName: "Content",
    typeFieldName: "Type",
    addedRolesFieldName: "Added Roles",
    removedRolesFieldName: "Removed Roles",

    unknownValue: "Unknown",
    noneValue: "none",
    noReasonProvided: "No reason provided",
    emptyOrUncached: "(empty or uncached)",
} as const;

/** Human-readable names for Discord channel type ids used in audit embeds. */
export const CHANNEL_TYPE_LABELS: Record<number, string> = {
    0: "Text Channel",
    2: "Voice Channel",
    4: "Category",
    5: "Announcement Channel",
    13: "Stage Channel",
    15: "Directory Channel",
};

