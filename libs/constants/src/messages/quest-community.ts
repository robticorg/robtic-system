/**
 * The weekly community challenge: the panel edited all week, and `/quest community`.
 *
 * Separate from `QUEST_MESSAGES` because this surface is one shared embed rather than a member's own
 * state — and separate from `COMMUNITY_MESSAGES`, which belongs to the support/staff bot and has
 * nothing to do with quests despite the word.
 */

const relative = (date: Date): string => `<t:${Math.floor(date.getTime() / 1000)}:R>`;

/** The rank bonus, spelled once so the panel and `/quest-config community` cannot disagree. */
const RANK_BONUS = "🥇 ×3 · 🥈🥉 ×2 · الرابع والخامس ×1.5";

export const QUEST_COMMUNITY_MESSAGES = {
    title: "🌍 تحدي الكوميونتي الأسبوعي",

    /** Placings on the contributor list. Beyond fifth it falls back to a plain number. */
    medals: ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"] as readonly string[],

    rankBonus: RANK_BONUS,

    mission: (label: string) => `**${label}**`,

    progressField: (percent: number) => `التقدم — ${percent}%`,
    progressValue: (bar: string, total: number, target: number) =>
        `\`${bar}\`\n${total.toLocaleString()} / ${target.toLocaleString()}`,

    rewardField: "المكافأة",
    rewardValue: (rewardBase: number) => `🎯 ${rewardBase.toLocaleString()} نقطة لكل وحد\n${RANK_BONUS}`,

    timeLeftField: "الوقت المتبقي",
    timeLeftValue: relative,

    topField: "أكثر المساهمين",
    topRow: (medal: string, discordId: string, amount: number) =>
        `${medal} <@${discordId}> — ${amount.toLocaleString()}`,
    fallbackMedal: (index: number) => `${index + 1}.`,

    footerCompleted: (contributors: number) => `خلّصه أكثر من ${contributors} شخص`,
    footerMissed: "خلص الأسبوع قبل ما نوصل للهدف",
    footerRunning: "الكل يساهم تلقائيًا — بس خلك نشيط",

    /** `/quest community` with nothing running. */
    noneRunning: "مافيه تحدي شغال الحين. بيبدأ وحد جديد أول الأسبوع.",
    disabled: "تحديات الكوميونتي مقفلة بهذا السيرفر.",

    /** The personal fields `/quest community` adds on top of the shared panel. */
    yourContributionField: "مساهمتك",
    yourContributionQualified: (amount: number) => `${amount.toLocaleString()} — مؤهل تاخذ المكافأة`,
    yourContributionShort: (amount: number, missing: number) =>
        `${amount.toLocaleString()} — ناقصك ${missing.toLocaleString()} عشان تتأهل`,

    contributorsField: "عدد المساهمين",
} as const;
