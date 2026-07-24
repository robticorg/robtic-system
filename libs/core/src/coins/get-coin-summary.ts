import { CoinsRepository } from "@database/repositories";
import { getCoinRates, type CoinRates } from "./get-coin-rates";

export interface CoinSummary {
    coins: number;
    rank: number;
    /** Progress toward the next message-earned coin. */
    messageProgress: number;
    /** Progress toward the next combo-earned coin. */
    comboProgress: number;
    rates: CoinRates;
}

/** One member's coin balance, rank, and progress toward their next coins. */
export async function getCoinSummary(guildId: string, discordId: string): Promise<CoinSummary> {
    const [record, rank, rates] = await Promise.all([
        CoinsRepository.get(guildId, discordId),
        CoinsRepository.getRank(guildId, discordId),
        getCoinRates(guildId),
    ]);

    return {
        coins: record?.coins ?? 0,
        rank,
        messageProgress: record?.messageProgress ?? 0,
        comboProgress: record?.comboProgress ?? 0,
        rates,
    };
}
