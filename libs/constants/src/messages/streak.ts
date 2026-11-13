import { bilingual } from "@utils/lang-context";

/** DM text sent by the streak scheduler. */
export const STREAK_DM_MESSAGES = bilingual({
    expired: (lostStreak: number) =>
        `💔 Your streak has ended.\n\nStreak lost: ${lostStreak}\n\nA moderator can bring it back within 3 days.`,
    expiringSoon: "⚠️ Your streak ends in less than two hours.\n\nSend one message in the streak channel to keep it.",
}, {
    expired: (lostStreak: number) =>
        `💔 انتهى الستريك حقك.\n\nالستريك المفقود: ${lostStreak}\n\nيقدر أحد المشرفين يرجعه خلال 3 أيام.`,
    expiringSoon: "⚠️ الستريك حقك بينتهي خلال أقل من ساعتين.\n\nأرسل رسالة وحدة في روم الستريك عشان تحافظ عليه.",
});

/** Public streak announcements. */
export const STREAK_MESSAGES = bilingual({
    reached: (userId: string, current: number, best: number) =>
        `🔥 <@${userId}> reached a **${current}**-day streak!` +
        (current >= best ? " New record! 🏆" : ` (best: **${best}**)`) +
        "\nCome back tomorrow to keep it going.",
}, {
    reached: (userId: string, current: number, best: number) =>
        `🔥 <@${userId}> وصل إلى **${current}** يوم ستريك!` +
        (current >= best ? " رقم قياسي جديد! 🏆" : ` (أفضل رقم: **${best}**)`) +
        "\nارجع بكرة عشان تكمل الستريك.",
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

/** Auto-managed `Streak N` role naming. */
export const STREAK_ROLE = {
    name: (level: number) => `Streak ${level}`,
    namePattern: /^Streak (\d+)$/i,
    creationReason: "Auto-created streak role",
    /** `fire<min>-<max>.png` icon files under images/streak. */
    iconFilenamePattern: /^fire(\d+)-(\d+)\.png$/i,
    iconsDirectory: ["images", "streak"] as const,
} as const;
