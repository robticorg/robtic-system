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

const TOP_DISPLAY_LIMIT = 5;
/** How far to scan for the viewer's own rank when outside the top 5 — reuses getTopEntries() with a larger limit. */
const VIEWER_RANK_SCAN_LIMIT = 100;

function formatEntry(rank: number, entry: TopEntry, unit: string, isViewer: boolean): string {
    const line = `#${rank} <@${entry.discordId}> — ${entry.value} ${unit}`;
    return isViewer ? `**${line}**` : line;
}

/** `viewerId` bolds that member's line — inline in the top 5, or appended below (with a "...." separator past rank 6). */
export async function buildTopEmbed(guild: Guild, category: TopCategory, period: ComboLeaderboardPeriod, lang: Lang, viewerId?: string): Promise<EmbedBuilder> {
    const entries = await getTopEntries(guild.id, category, period, TOP_DISPLAY_LIMIT);
    const unit = t(`top.unit_${category}`, lang);

    const lines = entries.map((e, i) => formatEntry(i + 1, e, unit, e.discordId === viewerId));

    if (viewerId && !entries.some(e => e.discordId === viewerId)) {
        const scanned = await getTopEntries(guild.id, category, period, VIEWER_RANK_SCAN_LIMIT);
        const viewerIndex = scanned.findIndex(e => e.discordId === viewerId);

        if (viewerIndex !== -1) {
            const rank = viewerIndex + 1;
            if (rank > TOP_DISPLAY_LIMIT + 1) lines.push("....");
            lines.push(formatEntry(rank, scanned[viewerIndex], unit, true));
        }
    }

    const description = lines.length ? lines.join("\n") : t("top.no_entries", lang);

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
