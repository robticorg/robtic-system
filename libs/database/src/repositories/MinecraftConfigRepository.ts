import { MinecraftConfig, type IMinecraftConfig } from "@database/models/MinecraftConfig";

export class MinecraftConfigRepository {
    static async get(guildId: string): Promise<IMinecraftConfig | null> {
        return MinecraftConfig.findOne({ guildId });
    }

    static async getOrCreate(guildId: string): Promise<IMinecraftConfig> {
        return MinecraftConfig.findOneAndUpdate(
            { guildId },
            { $setOnInsert: { guildId } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IMinecraftConfig>;
    }
}
