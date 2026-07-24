import { CoinSettingsRepository } from "@database/repositories";
import { COIN_DEFAULTS } from "@constants";

export interface CoinRates {
    messagesPerCoin: number;
    comboPerCoin: number;
    streakRewards: { streak: number; coins: number }[];
}

/** The guild's coin-earning rates, falling back to COIN_DEFAULTS where unset. */
export async function getCoinRates(guildId: string): Promise<CoinRates> {
    const settings = await CoinSettingsRepository.get(guildId);
    return {
        messagesPerCoin: settings?.messagesPerCoin ?? COIN_DEFAULTS.messagesPerCoin,
        comboPerCoin: settings?.comboPerCoin ?? COIN_DEFAULTS.comboPerCoin,
        streakRewards: settings?.streakRewards ?? [],
    };
}
