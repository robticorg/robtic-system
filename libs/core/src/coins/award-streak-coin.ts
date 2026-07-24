import { CoinsRepository } from "@database/repositories";
import { getCoinRates } from "./get-coin-rates";

/**
 * Pays out the configured coins when a streak reaches a rewarded day-count (e.g. 5 → 1 coin,
 * 15 → 2 coins). Exact match only — the streak increments one day at a time, so each threshold
 * fires once per streak run. Returns coins just earned.
 */
export async function awardStreakCoin(
    guildId: string,
    discordId: string,
    username: string,
    currentStreak: number,
): Promise<number> {
    const rates = await getCoinRates(guildId);
    const reward = rates.streakRewards.find(r => r.streak === currentStreak);
    if (!reward || reward.coins <= 0) return 0;

    await CoinsRepository.addCoins(guildId, discordId, username, reward.coins);
    return reward.coins;
}
