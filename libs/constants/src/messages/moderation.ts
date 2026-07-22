/** Display titles per punishment type, reused across proof, approval, and notice embeds. */
export const PUNISH_TITLES = {
    warn: "⚠️ Warning",
    mute: "🔇 Mute",
    ban: "🔨 Ban",
} as const;

/** Text for the proof-of-evidence modal, DM prompt, and proof log embed. */
export const PUNISH_PROOF_MESSAGES = {
    modalTitle: (typeTitle: string) => `${typeTitle} — Proof Required`,
    noteLabel: "Proof note",
    noteDescription: "Optional context for the evidence you're attaching",
    fileLabel: "Proof image",
    fileDescription: "Attach a screenshot/image showing the reason for this action",

    submittedTitle: (typeTitle: string) => `${typeTitle} — Proof Submitted`,
    targetFieldName: "Target",
    moderatorFieldName: "Moderator",
    noteFieldName: "Note",

    dmDescription: (type: string, targetId: string) =>
        `You used the \`${type}\` shortcut on <@${targetId}>. Click below to attach proof before this action is finalized.`,
    dmButtonLabel: "Submit Proof",
    dmButtonEmoji: "📎",
} as const;

/** Text for the senior-approval request posted to the punishments case channel. */
export const PUNISH_APPROVAL_MESSAGES = {
    title: (typeTitle: string) => `${typeTitle} Approval Required`,
    targetFieldName: "Target",
    requestedByFieldName: "Requested By",
    reasonFieldName: "Reason",
    durationFieldName: "Duration",
    durationValue: (hours: string) => `${hours} hour(s)`,
    typeFieldName: "Type",
    permanentBanValue: "Permanent Ban",
    tempBanValue: (days: string) => `Temp Ban (${days} day(s))`,
    approveLabel: "Approve",
    approveEmoji: "✅",
    denyLabel: "Deny",
    denyEmoji: "❌",
} as const;

/** Field titles for the cross-server audit embeds. */
export const AUDIT_EMBED_MESSAGES = {
    memberJoinTitle: "📥 Member Joined",
    memberLeaveTitle: "📤 Member Left",
    memberKickTitle: "👢 Member Kicked",
    memberBanTitle: "🔨 Member Banned",
    messageDeleteTitle: "🗑️ Message Deleted",
    channelCreateTitle: "📁 Channel Created",
    channelDeleteTitle: "🗂️ Channel Deleted",
    roleUpdateTitle: "🎭 Role Updated",
} as const;
