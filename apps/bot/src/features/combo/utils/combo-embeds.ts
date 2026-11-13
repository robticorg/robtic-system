import { EmbedBuilder, type Guild } from "discord.js";
import { COLORS, COMBO_CONFIG, type ComboLeaderboardPeriod, type ComboLeaderboardType } from "@constants";
import { L, bilingual, currentLang, formatDuration } from "@utils";
import { ComboSettingsRepository, ComboRepository, ComboUserStatsRepository } from "@database/repositories";
import { getUserHighestCombo } from "@core/combo";
import { getUserComboRank } from "../functions/combo";
import { heatStatusLabel } from "../functions/heat";
import { getFavoritePartner } from "@core/combo";
import { getHistoryForUser } from "../functions/history";
import { getLeaderboard } from "../functions/leaderboard";
import { getServerRecords } from "../functions/records";
import { t, type Lang } from "@bot/utils/lang";

export interface ComboTarget {
    id: string;
    username: string;
    avatarUrl: string;
}

export const LEADERBOARD_PERIOD_LABELS = bilingual<Record<ComboLeaderboardPeriod, string>>(
    { daily: "Today", weekly: "This week", monthly: "This month", alltime: "All time" },
    { daily: "يومي", weekly: "أسبوعي", monthly: "شهري", alltime: "كل الأوقات" },
);

export const LEADERBOARD_TYPE_LABELS = bilingual<Record<ComboLeaderboardType, string>>(
    { combo: "Top combo", streak: "Conversation streak", partner: "Favourite partner" },
    { combo: "أعلى كومبو", streak: "تتابع المحادثة", partner: "الشريك المفضل" },
);

/** Display-only: the stored level value (COMBO_LEVELS names) stays English internally. */
const LEVEL_NAME_AR: Record<string, string> = {
    Bronze: "البرونزي",
    Silver: "الفضي",
    Gold: "الذهبي",
    Diamond: "الماسي",
    Legendary: "الأسطوري",
};

const translateLevel = (level: string): string => (currentLang() === "ar" ? LEVEL_NAME_AR[level] ?? level : level);
const days = (n: number) => L(`${n} day${n === 1 ? "" : "s"}`, `${n} يوم`);
const none = () => L("None", "لا يوجد");

function baseEmbed(title: string): EmbedBuilder {
    return new EmbedBuilder().setTitle(title).setColor(COLORS.activity).setTimestamp();
}

async function favoritePartnerLine(guildId: string, userId: string): Promise<string> {
    const favorite = getFavoritePartner(await ComboUserStatsRepository.get(guildId, userId));
    if (!favorite) return L("None yet", "لا يوجد بعد");
    return L(`<@${favorite.partnerId}> — ${favorite.conversations} conversations`, `<@${favorite.partnerId}> — ${favorite.conversations} محادثة`);
}

export async function buildStatusEmbed(guild: Guild, target: ComboTarget, lang: Lang = currentLang()): Promise<EmbedBuilder> {
    const highest = await getUserHighestCombo(guild.id, target.id);
    const rank = await getUserComboRank(guild.id, target.id);
    const activeCombos = await ComboRepository.findActiveForUser(guild.id, target.id);
    const favoriteLine = await favoritePartnerLine(guild.id, target.id);

    const embed = baseEmbed(t("combo.status_title", lang, { username: target.username })).setThumbnail(target.avatarUrl);

    if (highest) {
        embed.addFields(
            { name: t("combo.current_combo", lang), value: L(`**${highest.pair.currentScore}** with <@${highest.partnerId}>`, `**${highest.pair.currentScore}** مع <@${highest.partnerId}>`), inline: true },
            { name: t("combo.level", lang), value: translateLevel(highest.pair.level), inline: true },
            { name: t("combo.heat", lang), value: `🔥 ${Math.round(highest.pair.heat)}% — ${heatStatusLabel(highest.pair.heat)}`, inline: true },
            { name: t("combo.conversation_streak", lang), value: `${highest.pair.streakCurrent} ${t("combo.days", lang, { best: `${highest.pair.streakBest}` })}`, inline: true },
        );
    } else {
        embed.addFields({ name: t("combo.current_combo", lang), value: t("combo.no_active_combo", lang) });
    }

    embed.addFields(
        { name: L("Favourite partner", "الشريك المفضل"), value: favoriteLine, inline: true },
        { name: L("Rank", "الترتيب"), value: rank > 0 ? `#${rank}` : L("Unranked", "غير مصنف"), inline: true },
        { name: L("Active combos", "الكومبوهات النشطة"), value: `${activeCombos.length}`, inline: true },
    );

    return embed;
}

export async function buildStatisticsEmbed(guild: Guild, target: ComboTarget): Promise<EmbedBuilder> {
    const highest = await getUserHighestCombo(guild.id, target.id);
    const stats = await ComboUserStatsRepository.get(guild.id, target.id);
    const favoriteLine = await favoritePartnerLine(guild.id, target.id);

    const avgCombo = stats && stats.totalConversations > 0 ? Math.round(stats.totalScoreSum / stats.totalConversations) : 0;
    const avgDuration = stats && stats.totalConversations > 0 ? Math.round(stats.totalDurationMs / stats.totalConversations) : 0;

    return baseEmbed(L(`📊 Combo stats — ${target.username}`, `📊 إحصائيات الكومبو — ${target.username}`))
        .setThumbnail(target.avatarUrl)
        .addFields(
            { name: L("Current combo", "الكومبو الحالي"), value: highest ? `${highest.pair.currentScore} (${translateLevel(highest.pair.level)})` : none(), inline: true },
            { name: L("Best combo", "أفضل كومبو"), value: stats ? `${stats.bestComboScore}${stats.bestComboPartnerId ? L(` with <@${stats.bestComboPartnerId}>`, ` مع <@${stats.bestComboPartnerId}>`) : ""}` : none(), inline: true },
            { name: L("Favourite partner", "الشريك المفضل"), value: favoriteLine, inline: true },
            { name: L("Conversation streak", "تتابع المحادثة الحالي"), value: days(highest ? highest.pair.streakCurrent : 0), inline: true },
            { name: L("Best conversation streak", "أفضل تتابع محادثة"), value: days(stats?.bestStreakEver ?? 0), inline: true },
            { name: L("Conversations", "إجمالي المحادثات"), value: `${stats?.totalConversations ?? 0}`, inline: true },
            { name: L("Different partners", "عدد الشركاء المختلفين"), value: `${stats?.distinctPartners ?? 0}`, inline: true },
            { name: L("Messages", "الرسائل"), value: `${stats?.totalMessages ?? 0}`, inline: true },
            { name: L("Average combo", "متوسط الكومبو"), value: `${avgCombo}`, inline: true },
            { name: L("Average length", "متوسط المدة"), value: formatDuration(avgDuration), inline: true },
            { name: L("Longest conversation", "أطول محادثة"), value: formatDuration(stats?.longestConversationMs ?? 0), inline: true },
        );
}

export async function buildHistoryEmbed(guild: Guild, target: ComboTarget): Promise<EmbedBuilder> {
    const history = await getHistoryForUser(guild.id, target.id);

    const description = history.length
        ? history.map(h => {
            const partnerId = h.userAId === target.id ? h.userBId : h.userAId;
            return `<@${partnerId}> — **${h.score}** (${translateLevel(h.level)}) — ${formatDuration(h.durationMs)} — <t:${Math.floor(h.endedAt.getTime() / 1000)}:R>`;
        }).join("\n")
        : L("No past combos yet.", "لا توجد كومبوهات سابقة بعد.");

    return baseEmbed(L(`📜 Combo history — ${target.username}`, `📜 سجل الكومبو — ${target.username}`)).setDescription(description.slice(0, 4096));
}

export async function buildLeaderboardEmbed(
    guild: Guild,
    period: ComboLeaderboardPeriod,
    type: ComboLeaderboardType,
): Promise<EmbedBuilder> {
    const entries = await getLeaderboard(guild.id, period, type);

    const description = entries.length
        ? entries.map((e, i) => `**${i + 1}.** <@${e.discordId}> — ${Math.round(e.value)}`).join("\n")
        : L("No data for this period yet.", "لا توجد بيانات لهذه الفترة بعد.");

    return baseEmbed(`🏆 ${LEADERBOARD_TYPE_LABELS[type]} — ${LEADERBOARD_PERIOD_LABELS[period]}`)
        .setDescription(description)
        .setFooter({ text: guild.name });
}

export async function buildServerRecordsEmbed(guild: Guild): Promise<EmbedBuilder> {
    const records = await getServerRecords(guild.id);

    const line = (entry: { value: number; userAId: string; userBId: string } | null, formatter: (v: number) => string) =>
        entry ? `${formatter(entry.value)} — <@${entry.userAId}> & <@${entry.userBId}>` : L("Not set yet", "لم يُسجَّل بعد");

    return baseEmbed(L(`🏛️ Server records — ${guild.name}`, `🏛️ الأرقام القياسية للسيرفر — ${guild.name}`)).addFields(
        { name: L("Highest combo ever", "أعلى كومبو على الإطلاق"), value: line(records.highestComboEver, v => `${v}`) },
        { name: L("Longest conversation", "أطول محادثة"), value: line(records.longestConversation, formatDuration) },
        { name: L("Most messages", "أكثر عدد رسائل"), value: line(records.mostMessages, v => `${v}`) },
        { name: L("Highest heat", "أعلى حرارة"), value: line(records.highestHeat, v => `${Math.round(v)}%`) },
        { name: L("Longest conversation streak", "أطول تتابع محادثة"), value: line(records.longestConversationStreak, v => days(v)) },
    );
}

export async function buildSettingsEmbed(guild: Guild): Promise<EmbedBuilder> {
    const settings = await ComboSettingsRepository.get(guild.id);
    const roleId = settings?.championRoleId;
    const role = roleId ? guild.roles.cache.get(roleId) : null;

    const min = settings?.minScorePerMessage ?? COMBO_CONFIG.minScorePerMessage;
    const max = settings?.maxScorePerMessage ?? COMBO_CONFIG.maxScorePerMessage;
    const isCustom = settings?.minScorePerMessage != null || settings?.maxScorePerMessage != null;

    return baseEmbed(L("⚙️ Combo settings", "⚙️ إعدادات الكومبو")).addFields(
        { name: L("Champion role", "رتبة البطل"), value: role ? `${role}` : L("Not set", "غير مُعدة") },
        { name: L("Combo points per message", "نقاط الكومبو لكل رسالة"), value: `${min} — ${max}${isCustom ? "" : L(" (default)", " (افتراضي)")}` },
    );
}
