import { bilingual } from "@utils/lang-context";

/** Titles and field labels for the moderation audit embeds. */
export const AUDIT_MESSAGES = bilingual({
    memberJoinTitle: "📘 Member joined",
    memberLeaveTitle: "📘 Member left",
    memberKickTitle: "📘 Member kicked",
    memberBanTitle: "📘 Member banned",
    messageDeleteTitle: "📘 Message deleted",
    channelCreateTitle: "📘 Channel created",
    channelDeleteTitle: "📘 Channel deleted",
    roleUpdateTitle: "📘 Member roles changed",

    userFieldName: "User",
    targetFieldName: "Target",
    executorFieldName: "By",
    reasonFieldName: "Reason",
    accountCreatedFieldName: "Account created",
    authorFieldName: "Author",
    channelFieldName: "Channel",
    messageIdFieldName: "Message ID",
    contentFieldName: "Content",
    typeFieldName: "Type",
    addedRolesFieldName: "Roles added",
    removedRolesFieldName: "Roles removed",

    unknownValue: "Unknown",
    noneValue: "none",
    noReasonProvided: "No reason given",
    emptyOrUncached: "(empty or not cached)",
}, {
    memberJoinTitle: "📘 دخول عضو",
    memberLeaveTitle: "📘 خروج عضو",
    memberKickTitle: "📘 طرد عضو",
    memberBanTitle: "📘 تبنيد عضو",
    messageDeleteTitle: "📘 حذف رسالة",
    channelCreateTitle: "📘 إنشاء روم",
    channelDeleteTitle: "📘 حذف روم",
    roleUpdateTitle: "📘 تغيير رتب عضو",

    userFieldName: "العضو",
    targetFieldName: "المستهدف",
    executorFieldName: "بواسطة",
    reasonFieldName: "السبب",
    accountCreatedFieldName: "إنشاء الحساب",
    authorFieldName: "الكاتب",
    channelFieldName: "الروم",
    messageIdFieldName: "آيدي الرسالة",
    contentFieldName: "المحتوى",
    typeFieldName: "النوع",
    addedRolesFieldName: "رتب مضافة",
    removedRolesFieldName: "رتب مسحوبة",

    unknownValue: "غير معروف",
    noneValue: "لا يوجد",
    noReasonProvided: "بدون سبب",
    emptyOrUncached: "(فارغة أو غير محفوظة)",
});

/** Human-readable names for Discord channel type ids used in audit embeds. */
export const CHANNEL_TYPE_LABELS: Record<number, string> = bilingual<Record<number, string>>({
    0: "Text channel",
    2: "Voice channel",
    4: "Category",
    5: "Announcement channel",
    13: "Stage channel",
    15: "Forum channel",
}, {
    0: "روم كتابي",
    2: "روم صوتي",
    4: "كاتيقوري",
    5: "روم إعلانات",
    13: "روم ستيج",
    15: "روم منتدى",
});
