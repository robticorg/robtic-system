import { bilingual } from "@utils/lang-context";

const plural = (n: number) => (n === 1 ? "" : "s");

/** `/points` replies. */
export const POINT_MESSAGES = bilingual({
    guildOnly: "This command can only be used in a server.",
    adminOnly: "Only administrators can adjust balances.",

    ownBalance: (points: number, rank: number) =>
        `🎯 You have **${points}** point${plural(points)}` + (rank > 0 ? `, rank **#${rank}**.` : "."),
    otherBalance: (name: string, points: number, rank: number) =>
        `🎯 **${name}** has **${points}** point${plural(points)}` + (rank > 0 ? `, rank **#${rank}**.` : "."),

    granted: (name: string, amount: number, total: number) => `🎯 Gave **${amount}** point${plural(amount)} to **${name}**. They now have **${total}**.`,
    deducted: (name: string, amount: number, total: number) => `🎯 Took **${amount}** point${plural(amount)} from **${name}**. They now have **${total}**.`,
    nothingToDeduct: (name: string) => `**${name}** has no points to remove.`,

    noHistory: "No point activity yet.",
}, {
    guildOnly: "هذا الأمر يعمل داخل السيرفر فقط.",
    adminOnly: "تعديل الرصيد للإدارة فقط.",

    ownBalance: (points: number, rank: number) =>
        `🎯 عندك **${points}** نقطة` + (rank > 0 ? `، ترتيبك **#${rank}**.` : "."),
    otherBalance: (name: string, points: number, rank: number) =>
        `🎯 **${name}** عنده **${points}** نقطة` + (rank > 0 ? `، ترتيبه **#${rank}**.` : "."),

    granted: (name: string, amount: number, total: number) => `🎯 تم إعطاء **${amount}** نقطة لـ **${name}**. صار عنده **${total}**.`,
    deducted: (name: string, amount: number, total: number) => `🎯 تم سحب **${amount}** نقطة من **${name}**. صار عنده **${total}**.`,
    nothingToDeduct: (name: string) => `**${name}** ما عنده نقاط تنسحب.`,

    noHistory: "ما في نشاط نقاط لين الحين.",
});
