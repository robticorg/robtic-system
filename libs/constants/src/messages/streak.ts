/** DM text sent by the streak scheduler. */
export const STREAK_DM_MESSAGES = {
    expired: (lostStreak: number) =>
        `💔 لقد انتهى تتابعك.\n\nالتتابع المفقود: ${lostStreak}\n\nيمكن لأحد المشرفين استرجاعه خلال 3 أيام.`,
    expiringSoon: "⚠️ سينتهي تتابعك خلال أقل من ساعتين.\n\nأرسل رسالة واحدة في قناة التتابع للحفاظ عليه.",
} as const;
