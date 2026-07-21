import { StreakRecovery, type IStreakRecovery } from "@database/models/StreakRecovery";

export class StreakRecoveryRepository {
    static async create(discordId: string, guildId: string, currentStreak: number, bestStreak: number): Promise<IStreakRecovery> {
        return StreakRecovery.findOneAndUpdate(
            { discordId, guildId },
            { currentStreak, bestStreak, expiredAt: new Date() },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IStreakRecovery>;
    }

    static async find(discordId: string, guildId: string): Promise<IStreakRecovery | null> {
        return StreakRecovery.findOne({ discordId, guildId });
    }

    static async delete(discordId: string, guildId: string): Promise<void> {
        await StreakRecovery.deleteOne({ discordId, guildId });
    }

    static async deleteOlderThan(guildId: string, cutoff: Date): Promise<void> {
        await StreakRecovery.deleteMany({ guildId, expiredAt: { $lte: cutoff } });
    }
}
