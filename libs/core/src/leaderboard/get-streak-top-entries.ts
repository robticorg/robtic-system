import { StreakRepository } from "@database/repositories";
import { DAY_MS, TOP_PERIOD_TO_DAYS, type ComboLeaderboardPeriod } from "@constants";
import type { TopEntry } from "@typings/top";

export async function getStreakTopEntries(
    guildId: string,
    period: ComboLeaderboardPeriod,
    limit: number,
): Promise<TopEntry[]> {
    if (period === "alltime") {
        const rows = await StreakRepository.getBestLeaderboard(guildId, limit);
        return rows.map(r => ({ discordId: r.discordId, value: r.bestStreak }));
    }
    if (period === "daily") {
        const rows = await StreakRepository.getCurrentLeaderboard(guildId, limit);
        return rows.map(r => ({ discordId: r.discordId, value: r.currentStreak }));
    }
    const since = new Date(Date.now() - TOP_PERIOD_TO_DAYS[period] * DAY_MS);
    const rows = await StreakRepository.getBestLeaderboardSince(guildId, since, limit);
    return rows.map(r => ({ discordId: r.discordId, value: r.bestStreak }));
}
