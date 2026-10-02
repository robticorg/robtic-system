/** DM text sent by the streak scheduler. */
export const STREAK_DM_MESSAGES = {
    expired: (lostStreak: number) =>
        `💔 لقد انتهى تتابعك.\n\nالتتابع المفقود: ${lostStreak}\n\nيمكن لأحد المشرفين استرجاعه خلال 3 أيام.`,
    expiringSoon: "⚠️ سينتهي تتابعك خلال أقل من ساعتين.\n\nأرسل رسالة واحدة في قناة التتابع للحفاظ عليه.",
} as const;

/** Public streak announcements. Arabic to match the rest of the streak surface. */
export const STREAK_MESSAGES = {
    reached: (userId: string, current: number, best: number) =>
        `🔥 <@${userId}> وصل إلى **${current}** يوم تتابع!` +
        (current >= best ? ` — رقم قياسي جديد! 🏆` : ` (أفضل رقم: **${best}**)`) +
        `\nعُد غداً لمواصلة تتابعك.`,
} as const;

/** Public level-up announcements from the XP system. */
export const LEVEL_UP_MESSAGES = {
    /** Message and voice are separate levels, so the announcement names which one went up. */
    reached: (userId: string, kind: "message" | "voice", level: number) => kind === "voice"
        ? `🎙️ <@${userId}> وصل إلى **مستوى الصوت ${level}**! تهانينا 🎉`
        : `📈 <@${userId}> وصل إلى **مستوى الرسائل ${level}**! تهانينا 🎉`,
} as const;

/** Auto-managed `Streak N` role naming. */
export const STREAK_ROLE = {
    name: (level: number) => `Streak ${level}`,
    namePattern: /^Streak (\d+)$/i,
    creationReason: "Auto-created streak role",
    /** `fire<min>-<max>.png` icon files under images/streak. */
    iconFilenamePattern: /^fire(\d+)-(\d+)\.png$/i,
    iconsDirectory: ["images", "streak"] as const,
} as const;
