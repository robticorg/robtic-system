import { CoinsRepository } from "@database/repositories";
import { getCoinRates } from "./get-coin-rates";

/** Adds earned combo score toward the guild's combo-per-coin rate. Returns coins just earned. */
export async function awardComboCoin(
    guildId: string,
    discordId: string,
    username: string,
    scoreGain: number,
): Promise<number> {
    const rates = await getCoinRates(guildId);
    return CoinsRepository.addProgress(guildId, discordId, username, "combo", scoreGain, rates.comboPerCoin);
}
