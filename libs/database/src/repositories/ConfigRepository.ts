import { BotConfig, type IBotConfig } from "@database/models/BotConfig";

export class ConfigRepository {
    static async get(key: string, botName: string): Promise<IBotConfig | null> {
        return BotConfig.findOne({ key, botName });
    }

    static async set(key: string, botName: string, value: unknown, updatedBy: string): Promise<IBotConfig> {
        const existing = await BotConfig.findOne({ key, botName });
        if (existing) {
            existing.value = value;
            existing.updatedBy = updatedBy;
            return existing.save();
        }
        return BotConfig.create({ key, botName, value, updatedBy, enabled: true });
    }

    static async delete(key: string, botName: string): Promise<void> {
        await BotConfig.deleteOne({ key, botName });
    }
}
