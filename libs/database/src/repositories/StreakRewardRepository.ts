import { StreakReward, type IStreakReward } from "@database/models/StreakReward";

export class StreakRewardRepository {
    static async add(guildId: string, threshold: number, offer: string, createdBy: string): Promise<IStreakReward> {
        return StreakReward.findOneAndUpdate(
            { guildId, threshold },
            { $set: { offer, createdBy } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IStreakReward>;
    }

    static async remove(guildId: string, threshold: number): Promise<boolean> {
        const result = await StreakReward.deleteOne({ guildId, threshold });
        return result.deletedCount > 0;
    }

    static async get(guildId: string, threshold: number): Promise<IStreakReward | null> {
        return StreakReward.findOne({ guildId, threshold });
    }

    static async list(guildId: string): Promise<IStreakReward[]> {
        return StreakReward.find({ guildId }).sort({ threshold: 1 });
    }
}
