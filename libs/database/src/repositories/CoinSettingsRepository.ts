import { CoinSettings, type ICoinSettings, type ICoinStreakReward } from "@database/models/CoinSettings";

export class CoinSettingsRepository {
    static async get(guildId: string): Promise<ICoinSettings | null> {
        return CoinSettings.findOne({ guildId });
    }

    static async setRates(guildId: string, messagesPerCoin: number, comboPerCoin: number): Promise<ICoinSettings> {
        return CoinSettings.findOneAndUpdate(
            { guildId },
            { $set: { messagesPerCoin, comboPerCoin } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<ICoinSettings>;
    }

    static async setStreakRewards(guildId: string, rewards: ICoinStreakReward[]): Promise<ICoinSettings> {
        return CoinSettings.findOneAndUpdate(
            { guildId },
            { $set: { streakRewards: rewards } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<ICoinSettings>;
    }
}
