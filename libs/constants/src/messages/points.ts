import { bilingual } from "@utils/lang-context";

const plural = (n: number) => (n === 1 ? "" : "s");

/** `/points` replies. */
export const POINT_MESSAGES = bilingual({
    guildOnly: "This command can only be used in a server.",
    adminOnly: "Only administrators can adjust balances.",

    ownBalance: (points: number, rc: number, rank: number) =>
        `🎯 You have **${points}** point${plural(points)}` + (rc > 0 ? ` and **${rc}** RC` : "") + (rank > 0 ? `, rank **#${rank}**.` : "."),
    otherBalance: (name: string, points: number, rc: number, rank: number) =>
        `🎯 **${name}** has **${points}** point${plural(points)}` + (rc > 0 ? ` and **${rc}** RC` : "") + (rank > 0 ? `, rank **#${rank}**.` : "."),

    granted: (name: string, amount: number, total: number) => `🎯 Gave **${amount}** point${plural(amount)} to **${name}**. They now have **${total}**.`,
    deducted: (name: string, amount: number, total: number) => `🎯 Took **${amount}** point${plural(amount)} from **${name}**. They now have **${total}**.`,
    nothingToDeduct: (name: string) => `**${name}** has no points to remove.`,

    conversionDisabled: "Converting points to RC is switched off in this server.",
    belowMinimum: (min: number) => `❌ The smallest conversion is **${min}** points.`,
    notAMultiple: (rate: number) => `❌ Convert in multiples of **${rate}** points (that is one RC).`,
    insufficient: (have: number) => `❌ You only have **${have}** point${plural(have)}.`,
    converted: (points: number, rc: number, pointsLeft: number, rcTotal: number) =>
        `✨ Converted **${points}** points into **${rc}** RC.\nYou now have **${pointsLeft}** points and **${rcTotal}** RC.`,

    noHistory: "No point activity yet.",
}, {
    guildOnly: "هذا الأمر يعمل داخل السيرفر فقط.",
    adminOnly: "تعديل الرصيد للإدارة فقط.",

    ownBalance: (points: number, rc: number, rank: number) =>
        `🎯 عندك **${points}** نقطة` + (rc > 0 ? ` و **${rc}** RC` : "") + (rank > 0 ? `، ترتيبك **#${rank}**.` : "."),
    otherBalance: (name: string, points: number, rc: number, rank: number) =>
        `🎯 **${name}** عنده **${points}** نقطة` + (rc > 0 ? ` و **${rc}** RC` : "") + (rank > 0 ? `، ترتيبه **#${rank}**.` : "."),

    granted: (name: string, amount: number, total: number) => `🎯 تم إعطاء **${amount}** نقطة لـ **${name}**. صار عنده **${total}**.`,
    deducted: (name: string, amount: number, total: number) => `🎯 تم سحب **${amount}** نقطة من **${name}**. صار عنده **${total}**.`,
    nothingToDeduct: (name: string) => `**${name}** ما عنده نقاط تنسحب.`,

    conversionDisabled: "تحويل النقاط إلى RC مقفل في هذا السيرفر.",
    belowMinimum: (min: number) => `❌ أقل تحويل هو **${min}** نقطة.`,
    notAMultiple: (rate: number) => `❌ حوّل بمضاعفات **${rate}** نقطة (تساوي RC واحد).`,
    insufficient: (have: number) => `❌ عندك **${have}** نقطة فقط.`,
    converted: (points: number, rc: number, pointsLeft: number, rcTotal: number) =>
        `✨ تم تحويل **${points}** نقطة إلى **${rc}** RC.\nصار عندك **${pointsLeft}** نقطة و **${rcTotal}** RC.`,

    noHistory: "ما في نشاط نقاط لين الحين.",
});
