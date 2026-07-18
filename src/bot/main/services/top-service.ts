import { EmbedBuilder, type Guild } from "discord.js";
import { StreakRepository, PeriodicStatRepository } from "@database/repositories";
import { getLeaderboard as getComboLeaderboard } from "./combo-leaderboard-service";
import { Colors } from "@core/config";
import type { ComboLeaderboardPeriod } from "@core/config";
import { t } from "@shared/utils/lang";
import type { Lang } from "@shared/utils/lang";

export type TopCategory = "streak" | "combo" | "xp" | "messages";
export const TOP_CATEGORIES: TopCategory[] = ["streak", "combo", "xp", "messages"];

export interface TopEntry {
    discordId: string;
    value: number;
}

const PERIOD_TO_DAYS: Record<"weekly" | "monthly", number> = { weekly: 7, monthly: 30 };

async function getStreakTopEntries(guildId: string, period: ComboLeaderboardPeriod, limit: number): Promise<TopEntry[]> {
    if (period === "alltime") {
        const rows = await StreakRepository.getBestLeaderboard(guildId, limit);
        return rows.map(r => ({ discordId: r.discordId, value: r.bestStreak }));
    }
    if (period === "daily") {
        const rows = await StreakRepository.getCurrentLeaderboard(guildId, limit);
        return rows.map(r => ({ discordId: r.discordId, value: r.currentStreak }));
    }
    const since = new Date(Date.now() - PERIOD_TO_DAYS[period] * 24 * 60 * 60 * 1000);
    const rows = await StreakRepository.getBestLeaderboardSince(guildId, since, limit);
    return rows.map(r => ({ discordId: r.discordId, value: r.bestStreak }));
}

export async function getTopEntries(guildId: string, category: TopCategory, period: ComboLeaderboardPeriod, limit = 5): Promise<TopEntry[]> {
    if (category === "combo") {
        const rows = await getComboLeaderboard(guildId, period, "combo", limit);
        return rows.map(r => ({ discordId: r.discordId, value: r.value }));
    }
    if (category === "xp" || category === "messages") {
        const rows = await PeriodicStatRepository.getTop(guildId, period, category, limit);
        return rows.map(r => ({ discordId: r.discordId, value: r.value }));
    }
    return getStreakTopEntries(guildId, period, limit);
}

const CATEGORY_EMOJI: Record<TopCategory, string> = { streak: "🔥", combo: "💬", xp: "⭐", messages: "📨" };

export async function buildTopEmbed(guild: Guild, category: TopCategory, period: ComboLeaderboardPeriod, lang: Lang): Promise<EmbedBuilder> {
    const entries = await getTopEntries(guild.id, category, period);
    const unit = t(`top.unit_${category}`, lang);

    const description = entries.length
        ? entries.map((e, i) => `**#${i + 1}** <@${e.discordId}> — **${e.value}** ${unit}`).join("\n")
        : t("top.no_entries", lang);

    return new EmbedBuilder()
        .setTitle(t("top.title", lang, {
            emoji: CATEGORY_EMOJI[category],
            category: t(`top.category_${category}`, lang),
            period: t(`top.period_${period}`, lang),
            guild: guild.name,
        }))
        .setDescription(description)
        .setColor(Colors.activity)
        .setTimestamp();
}
