import { Streak, type IStreak } from "@database/models/Streak";

export class StreakRepository {
    static async find(discordId: string, guildId: string): Promise<IStreak | null> {
        return Streak.findOne({ discordId, guildId });
    }

    static async findOrCreate(discordId: string, guildId: string, username: string): Promise<IStreak> {
        let record = await Streak.findOne({ discordId, guildId });
        if (!record) {
            record = await Streak.create({ discordId, guildId, username });
        }
        return record;
    }

    static async applyIncrement(
        discordId: string,
        guildId: string,
        currentStreak: number,
        bestStreak: number,
        messageContent: string,
    ): Promise<IStreak | null> {
        const now = new Date();
        return Streak.findOneAndUpdate(
            { discordId, guildId },
            {
                currentStreak,
                bestStreak,
                lastIncrement: now,
                lastMessageAt: now,
                lastMessageContent: messageContent,
                reminderSent: false,
                active: true,
            },
            { returnDocument: "after" }
        );
    }

    static async markReminderSent(discordId: string, guildId: string): Promise<void> {
        await Streak.updateOne({ discordId, guildId }, { reminderSent: true });
    }

    static async expire(discordId: string, guildId: string): Promise<void> {
        await Streak.updateOne(
            { discordId, guildId },
            { currentStreak: 0, active: false, reminderSent: false }
        );
    }

    static async restore(discordId: string, guildId: string, currentStreak: number, bestStreak: number): Promise<IStreak | null> {
        return Streak.findOneAndUpdate(
            { discordId, guildId },
            {
                currentStreak,
                bestStreak,
                lastIncrement: new Date(),
                reminderSent: false,
                active: true,
            },
            { upsert: true, returnDocument: "after" }
        );
    }

    static async getCurrentLeaderboard(guildId: string, limit = 5): Promise<IStreak[]> {
        return Streak.find({ guildId, active: true, currentStreak: { $gt: 0 } })
            .sort({ currentStreak: -1 })
            .limit(limit);
    }

    static async getBestLeaderboard(guildId: string, limit = 5): Promise<IStreak[]> {
        return Streak.find({ guildId, bestStreak: { $gt: 0 } })
            .sort({ bestStreak: -1 })
            .limit(limit);
    }

    static async getRank(discordId: string, guildId: string): Promise<number> {
        const user = await Streak.findOne({ discordId, guildId });
        if (!user || !user.active || user.currentStreak <= 0) return -1;
        const above = await Streak.countDocuments({
            guildId,
            active: true,
            currentStreak: { $gt: user.currentStreak },
        });
        return above + 1;
    }

    static async getBestRank(discordId: string, guildId: string): Promise<number> {
        const user = await Streak.findOne({ discordId, guildId });
        if (!user || user.bestStreak <= 0) return -1;
        const above = await Streak.countDocuments({
            guildId,
            bestStreak: { $gt: user.bestStreak },
        });
        return above + 1;
    }

    /** Active streaks whose expiry falls in (after, beforeOrEqual] and haven't been reminded yet. */
    static async findDueForReminder(guildId: string, after: Date, beforeOrEqual: Date): Promise<IStreak[]> {
        return Streak.find({
            guildId,
            active: true,
            reminderSent: false,
            lastIncrement: { $gt: after, $lte: beforeOrEqual },
        });
    }

    /** Active streaks whose expiry has already passed the given cutoff (lastIncrement + expireWindow <= now). */
    static async findExpired(guildId: string, cutoff: Date): Promise<IStreak[]> {
        return Streak.find({
            guildId,
            active: true,
            lastIncrement: { $lte: cutoff },
        });
    }
}
