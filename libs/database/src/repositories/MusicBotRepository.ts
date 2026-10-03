import { MusicBot, type IMusicBot } from "@database/models/MusicBot";

export class MusicBotRepository {
    /** Returns `null` when this bot account is already registered (the `botId` index is unique). */
    static async create(entry: {
        guildId: string;
        botId: string;
        applicationId: string;
        name: string;
        voiceChannelId: string;
        encryptedToken: string;
        createdBy: string;
    }): Promise<IMusicBot | null> {
        try {
            return await MusicBot.create(entry);
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return null;
            throw err;
        }
    }

    static async listByGuild(guildId: string): Promise<IMusicBot[]> {
        return MusicBot.find({ guildId }).sort({ createdAt: 1 });
    }

    static async countByGuild(guildId: string): Promise<number> {
        return MusicBot.countDocuments({ guildId });
    }

    /** Every music bot, for starting them all when the main bot comes online. */
    static async listAll(): Promise<IMusicBot[]> {
        return MusicBot.find({});
    }

    static async findByBotId(botId: string): Promise<IMusicBot | null> {
        return MusicBot.findOne({ botId });
    }

    /** Deletes a guild's music bot. Scoped to the guild, so one server can't remove another's. */
    static async delete(guildId: string, botId: string): Promise<IMusicBot | null> {
        return MusicBot.findOneAndDelete({ guildId, botId });
    }
}
