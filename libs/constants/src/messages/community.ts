import { bilingual } from "@utils/lang-context";

/** Embed titles/descriptions for the community bot's activity, support, and decay logs. */
export const COMMUNITY_MESSAGES = bilingual({
    levelUpTitle: "⬆️ Level up!",
    xpGainedTitle: "✨ XP gained",
    levelUpDescription: (username: string, level: number) => `**${username}** reached level **${level}**!`,

    supportPointsTitle: "🎫 Support points",
    supportPenaltyTitle: "🎫 Support penalty",

    sessionTitles: {
        created: "📩 Support session opened",
        claimed: "🤚 Support session claimed",
        resolved: "✅ Support session resolved",
        "auto-closed": "⏰ Support session closed automatically",
        reassigned: "🔄 Support session reassigned",
    } as Record<string, string>,

    aiDecisionTitle: (fallback: boolean) => `🤖 AI decision${fallback ? " (fallback)" : ""}`,

    levelDownDecayTitle: "📉 Level down (inactivity)",
    xpDecayTitle: "📉 XP lost (inactivity)",

    staffPenaltyTitle: "⚠️ Staff support penalty",

    staffReminderTitle: "📌 Support channel reminder",
    staffReminderDescription:
        "Hey! You and another staff member have been chatting in a **support channel**.\n\n" +
        "Please keep support channels for helping members. Use staff channels for talk between staff.",

    claimWarningTitle: "⚠️ Session already claimed",
    claimWarningDescription: (channelId: string) =>
        `Another staff member already claimed the support session in <#${channelId}>.\n\n` +
        "Please don't step into claimed sessions. If the assigned staff member doesn't answer for **10 minutes**, the session is reassigned automatically.",

    claimTakeoverTitle: "🔄 Session reassigned to you",
    claimTakeoverDescription: (channelId: string, originalStaffId: string) =>
        `The previous staff member (<@${originalStaffId}>) didn't answer for over **10 minutes** in <#${channelId}>.\n\n` +
        "The session is yours now. Please help the member.",

    penaltyReasons: {
        ignoredUser: "Ignored the member for 10+ minutes, session reassigned",
        intruding: (claimedBy: string) => `Stepped into a session claimed by <@${claimedBy}>`,
        staffChatAfterWarning: "Kept chatting with staff after a warning",
    },

    resolutionReasons: {
        aiConversationEndStaff: "AI detected the conversation ended (staff)",
        memberEnded: "The member ended the conversation",
        takeoverDetails: (previousStaff: string) => `Previous staff: <@${previousStaff}> (inactive over 10 min, -1 point)`,
    },
}, {
    levelUpTitle: "⬆️ ترقية مستوى!",
    xpGainedTitle: "✨ خبرة جديدة",
    levelUpDescription: (username: string, level: number) => `**${username}** وصل للمستوى **${level}**!`,

    supportPointsTitle: "🎫 نقاط الدعم",
    supportPenaltyTitle: "🎫 خصم دعم",

    sessionTitles: {
        created: "📩 فتح جلسة دعم",
        claimed: "🤚 استلام جلسة دعم",
        resolved: "✅ حل جلسة دعم",
        "auto-closed": "⏰ إغلاق جلسة دعم تلقائياً",
        reassigned: "🔄 تحويل جلسة دعم",
    } as Record<string, string>,

    aiDecisionTitle: (fallback: boolean) => `🤖 قرار الذكاء الاصطناعي${fallback ? " (احتياطي)" : ""}`,

    levelDownDecayTitle: "📉 نزول مستوى (عدم نشاط)",
    xpDecayTitle: "📉 خسارة خبرة (عدم نشاط)",

    staffPenaltyTitle: "⚠️ خصم على الإداري",

    staffReminderTitle: "📌 تذكير روم الدعم",
    staffReminderDescription:
        "هلا! أنت وإداري ثاني تسولفون في **روم دعم**.\n\n" +
        "خلوا رومات الدعم لمساعدة الأعضاء، واستخدموا رومات الإدارة للسوالف بينكم.",

    claimWarningTitle: "⚠️ الجلسة مستلمة",
    claimWarningDescription: (channelId: string) =>
        `إداري ثاني استلم جلسة الدعم في <#${channelId}>.\n\n` +
        "لا تتدخل في الجلسات المستلمة. إذا ما رد الإداري المسؤول خلال **10 دقائق**، الجلسة تتحول تلقائياً.",

    claimTakeoverTitle: "🔄 تحولت لك الجلسة",
    claimTakeoverDescription: (channelId: string, originalStaffId: string) =>
        `الإداري السابق (<@${originalStaffId}>) ما رد أكثر من **10 دقائق** في <#${channelId}>.\n\n` +
        "الجلسة صارت لك. ساعد العضو.",

    penaltyReasons: {
        ignoredUser: "تجاهل العضو أكثر من 10 دقائق وتحولت الجلسة",
        intruding: (claimedBy: string) => `تدخل في جلسة استلمها <@${claimedBy}>`,
        staffChatAfterWarning: "استمر يسولف مع الإدارة بعد التنبيه",
    },

    resolutionReasons: {
        aiConversationEndStaff: "الذكاء الاصطناعي اكتشف نهاية المحادثة (إداري)",
        memberEnded: "العضو أنهى المحادثة",
        takeoverDetails: (previousStaff: string) => `الإداري السابق: <@${previousStaff}> (غير نشط أكثر من 10 دقائق، -1 نقطة)`,
    },
});
