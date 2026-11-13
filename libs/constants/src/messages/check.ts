import { bilingual } from "@utils/lang-context";

type StaffCounts = { supportPoints: number; publicChatPoints: number; staffChatPoints: number; moderationPoints: number; penalties: number };

const staffBreakdown = (s: StaffCounts) =>
    `> 🎧 ${s.supportPoints} · 💬 ${s.publicChatPoints} · 👥 ${s.staffChatPoints} · 🔨 ${s.moderationPoints}${s.penalties > 0 ? ` · ⚠️ -${s.penalties}` : ""}`;

/** Text for the admin `/check` (a.k.a. `!check`) lookup command. */
export const CHECK_MESSAGES = bilingual({
    adminOnly: "❌ Only administrators can use this command.",
    guildOnly: "This command can only be used in a server.",
    invalidValue: "Please give a whole number of 1 or more.",

    streakTitle: (value: number) => `🔥 Members with a ${value}-day streak`,
    streakNone: (value: number) => `No members have a **${value}-day** streak right now.`,
    streakSummary: (count: number, value: number) =>
        `**${count}** member${count === 1 ? "" : "s"} on a **${value}-day** streak:`,
    streakLine: (rank: number, discordId: string) => `**${rank}.** <@${discordId}>`,
    truncatedNote: (shown: number, total: number) => `\n\n…and ${total - shown} more (showing the first ${shown}).`,

    staffTitle: "🛡️ Staff activity",
    staffNone: "No staff activity has been recorded in this server yet.",
    staffSummary: (count: number) =>
        `**${count}** staff member${count === 1 ? "" : "s"} with recorded activity, ranked by total points:`,
    staffLine: (rank: number, discordId: string, total: number, staff: StaffCounts) =>
        `**${rank}.** <@${discordId}> — **${total}** pts\n${staffBreakdown(staff)}`,

    staffUserTitle: (username: string) => `🛡️ Staff activity: ${username}`,
    staffMemberNotFound: "That user is not in this server.",
    staffNotStaff: (discordId: string) => `<@${discordId}> is not a staff member.`,
    staffLegend: "🎧 support · 💬 public chat · 👥 staff chat · 🔨 moderation · ⚠️ penalties",
}, {
    adminOnly: "❌ هذا الأمر للإدارة فقط.",
    guildOnly: "هذا الأمر يعمل داخل السيرفر فقط.",
    invalidValue: "اكتب رقم صحيح من 1 أو أكثر.",

    streakTitle: (value: number) => `🔥 الأعضاء اللي عندهم ستريك ${value} يوم`,
    streakNone: (value: number) => `ما في أحد عنده ستريك **${value} يوم** حالياً.`,
    streakSummary: (count: number, value: number) => `**${count}** عضو عندهم ستريك **${value} يوم**:`,
    streakLine: (rank: number, discordId: string) => `**${rank}.** <@${discordId}>`,
    truncatedNote: (shown: number, total: number) => `\n\n…و ${total - shown} غيرهم (معروض أول ${shown}).`,

    staffTitle: "🛡️ نشاط الإدارة",
    staffNone: "ما في نشاط مسجل للإدارة في هذا السيرفر لين الحين.",
    staffSummary: (count: number) => `**${count}** إداري عندهم نشاط مسجل، مرتبين حسب مجموع النقاط:`,
    staffLine: (rank: number, discordId: string, total: number, staff: StaffCounts) =>
        `**${rank}.** <@${discordId}> — **${total}** نقطة\n${staffBreakdown(staff)}`,

    staffUserTitle: (username: string) => `🛡️ نشاط الإداري: ${username}`,
    staffMemberNotFound: "هذا الشخص غير موجود في السيرفر.",
    staffNotStaff: (discordId: string) => `<@${discordId}> ليس من الإدارة.`,
    staffLegend: "🎧 الدعم · 💬 الشات العام · 👥 شات الإدارة · 🔨 الإشراف · ⚠️ الخصومات",
});

/** Maximum members listed in one `/check` result before the list is truncated. */
export const CHECK_RESULT_LIMIT = 50;
