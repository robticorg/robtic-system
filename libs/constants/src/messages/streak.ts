import { bilingual } from "@utils/lang-context";

// The wording of the Streaks plugin's Robtic Rules (streaks.rrl), word for word.

/** DM text sent by the streak scheduler. */
export const STREAK_DM_MESSAGES = bilingual({
    expired: (lostStreak: number) => `Your ${lostStreak}-day streak ended. Start a new one today!`,
    expiringSoon: (current: number) => `⏳ Your ${current}-day streak ends in 2 hours. Send a message to keep it!`,
}, {
    expired: (lostStreak: number) => `انتهت سلسلتك (${lostStreak} يوم). ابدأ سلسلة جديدة اليوم!`,
    expiringSoon: (current: number) => `⏳ سلسلتك (${current} يوم) تنتهي خلال ساعتين. أرسل رسالة لتحافظ عليها!`,
});

/** The milestone post on a reward day. */
export const STREAK_MESSAGES = bilingual({
    reached: (userId: string, current: number) => `🔥 <@${userId}> reached a **${current}-day** streak!`,
}, {
    reached: (userId: string, current: number) => `🔥 <@${userId}> وصل إلى سلسلة **${current}** يوم!`,
});

/** Public level-up announcements from the XP system. */
export const LEVEL_UP_MESSAGES = bilingual({
    /** Message and voice are separate levels, so the announcement names which one went up. */
    reached: (userId: string, kind: "message" | "voice", level: number) => kind === "voice"
        ? `🎙️ <@${userId}> reached **voice level ${level}**! Congrats 🎉`
        : `📈 <@${userId}> reached **message level ${level}**! Congrats 🎉`,
}, {
    reached: (userId: string, kind: "message" | "voice", level: number) => kind === "voice"
        ? `🎙️ <@${userId}> وصل إلى **مستوى الصوت ${level}**! تهانينا 🎉`
        : `📈 <@${userId}> وصل إلى **مستوى الرسائل ${level}**! تهانينا 🎉`,
});
