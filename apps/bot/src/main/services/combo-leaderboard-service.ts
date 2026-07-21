import type { ICombo, IComboLeaderboardEntry } from "@database/models";
import { ComboLeaderboardRepository, ComboUserStatsRepository, type ComboLeaderboardUpsert } from "@database/repositories";
import { COMBO_CONFIG, COMBO_LEADERBOARD_PERIODS, type ComboLeaderboardPeriod, type ComboLeaderboardType } from "@core/config";
import { periodKeyFor, favoritePartnerWeight } from "@core/utils";
import { getFavoritePartner } from "./combo-favorite-partner";

/** Builds one batch of $max upserts for every currently-active pair — called once per scheduler tick, never per-message. */
export function buildActivePairSnapshotOps(guildId: string, pairs: ICombo[], now: Date): ComboLeaderboardUpsert[] {
    const ops: ComboLeaderboardUpsert[] = [];
    for (const pair of pairs) {
        for (const userId of [pair.userLowId, pair.userHighId]) {
            for (const period of COMBO_LEADERBOARD_PERIODS) {
                const periodKey = periodKeyFor(period, now);
                ops.push({ guildId, period, periodKey, type: "combo", discordId: userId, value: pair.currentScore });
                ops.push({ guildId, period, periodKey, type: "streak", discordId: userId, value: pair.streakCurrent });
            }
        }
    }
    return ops;
}

export async function snapshotActivePairs(guildId: string, pairs: ICombo[]): Promise<void> {
    await ComboLeaderboardRepository.bulkUpsertMax(buildActivePairSnapshotOps(guildId, pairs, new Date()));
}

/** Refreshes the Favorite Partner leaderboard entries for both participants of a just-ended conversation. */
export async function recordFavoritePartnerScore(guildId: string, userAId: string, userBId: string): Promise<void> {
    const now = new Date();
    const ops: ComboLeaderboardUpsert[] = [];

    for (const userId of [userAId, userBId]) {
        const stats = await ComboUserStatsRepository.get(guildId, userId);
        const favorite = getFavoritePartner(stats);
        if (!favorite) continue;

        const value = favoritePartnerWeight(favorite);
        for (const period of COMBO_LEADERBOARD_PERIODS) {
            ops.push({ guildId, period, periodKey: periodKeyFor(period, now), type: "partner", discordId: userId, value });
        }
    }

    await ComboLeaderboardRepository.bulkUpsertMax(ops);
}

export async function getLeaderboard(
    guildId: string,
    period: ComboLeaderboardPeriod,
    type: ComboLeaderboardType,
    limit: number = COMBO_CONFIG.leaderboardLimit,
): Promise<IComboLeaderboardEntry[]> {
    return ComboLeaderboardRepository.getTop(guildId, period, periodKeyFor(period, new Date()), type, limit);
}
