import { bilingual } from "@utils/lang-context";

/** Display titles per punishment type, reused across proof, approval, and notice embeds. */
export const PUNISH_TITLES = bilingual({
    warn: "⚠️ Warning",
    mute: "🔇 Mute",
    ban: "🔨 Ban",
}, {
    warn: "⚠️ تحذير",
    mute: "🔇 ميوت",
    ban: "🔨 باند",
});

/** Text for the proof-of-evidence modal, DM prompt, and proof log embed. */
export const PUNISH_PROOF_MESSAGES = bilingual({
    modalTitle: (typeTitle: string) => `${typeTitle}: proof required`,
    noteLabel: "Proof note",
    noteDescription: "Optional context for the evidence you're attaching",
    fileLabel: "Proof image",
    fileDescription: "Attach a screenshot showing the reason for this action",

    submittedTitle: (typeTitle: string) => `${typeTitle}: proof submitted`,
    targetFieldName: "Target",
    moderatorFieldName: "Moderator",
    noteFieldName: "Note",

    dmDescription: (type: string, targetId: string) =>
        `You used the \`${type}\` shortcut on <@${targetId}>. Attach proof below before this action is finalized.`,
    dmButtonLabel: "Submit proof",
    dmButtonEmoji: "📎",
}, {
    modalTitle: (typeTitle: string) => `${typeTitle}: الدليل مطلوب`,
    noteLabel: "ملاحظة الدليل",
    noteDescription: "شرح اختياري للدليل اللي ترفقه",
    fileLabel: "صورة الدليل",
    fileDescription: "أرفق صورة توضح سبب العقوبة",

    submittedTitle: (typeTitle: string) => `${typeTitle}: تم إرسال الدليل`,
    targetFieldName: "العضو",
    moderatorFieldName: "المشرف",
    noteFieldName: "ملاحظة",

    dmDescription: (type: string, targetId: string) =>
        `استخدمت اختصار \`${type}\` على <@${targetId}>. أرفق الدليل تحت قبل اعتماد العقوبة.`,
    dmButtonLabel: "إرسال الدليل",
    dmButtonEmoji: "📎",
});

/** Text for the senior-approval request posted to the punishments case channel. */
export const PUNISH_APPROVAL_MESSAGES = bilingual({
    title: (typeTitle: string) => `${typeTitle}: approval required`,
    targetFieldName: "Target",
    requestedByFieldName: "Requested by",
    reasonFieldName: "Reason",
    durationFieldName: "Duration",
    durationValue: (hours: string) => `${hours} hour(s)`,
    typeFieldName: "Type",
    permanentBanValue: "Permanent ban",
    tempBanValue: (days: string) => `Temporary ban (${days} day(s))`,
    approveLabel: "Approve",
    approveEmoji: "✅",
    denyLabel: "Deny",
    denyEmoji: "❌",
}, {
    title: (typeTitle: string) => `${typeTitle}: تحتاج موافقة`,
    targetFieldName: "العضو",
    requestedByFieldName: "طلب من",
    reasonFieldName: "السبب",
    durationFieldName: "المدة",
    durationValue: (hours: string) => `${hours} ساعة`,
    typeFieldName: "النوع",
    permanentBanValue: "باند دائم",
    tempBanValue: (days: string) => `باند مؤقت (${days} يوم)`,
    approveLabel: "موافقة",
    approveEmoji: "✅",
    denyLabel: "رفض",
    denyEmoji: "❌",
});
