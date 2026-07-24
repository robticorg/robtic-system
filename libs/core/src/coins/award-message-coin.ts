import { CoinsRepository } from "@database/repositories";
import { getCoinRates } from "./get-coin-rates";

/** Counts one real message toward the guild's messages-per-coin rate. Returns coins just earned. */
export async function awardMessageCoin(guildId: string, discordId: string, username: string): Promise<number> {
    const rates = await getCoinRates(guildId);
    return CoinsRepository.addProgress(guildId, discordId, username, "message", 1, rates.messagesPerCoin);
}
