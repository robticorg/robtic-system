import { HrConfig, type IHrConfig } from "@database/models/HrConfig";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { config: IHrConfig; expiresAt: number }>();

export class HrConfigRepository {
    static async findOrCreate(guildId: string): Promise<IHrConfig> {
        let config = await HrConfig.findOne({ guildId });
        if (!config) {
            config = await HrConfig.create({ guildId });
        }
        return config;
    }

    /** Hot-path entry point — read on every guild message by the staff-warn shortcut listener. */
    static async getCached(guildId: string): Promise<IHrConfig> {
        const cached = cache.get(guildId);
        if (cached && cached.expiresAt > Date.now()) return cached.config;

        const config = await this.findOrCreate(guildId);
        cache.set(guildId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
        return config;
    }

    static invalidate(guildId: string): void {
        cache.delete(guildId);
    }

    static async setLogChannel(guildId: string, channelId: string): Promise<IHrConfig> {
        const config = await HrConfig.findOneAndUpdate(
            { guildId },
            { $set: { staffWarnLogChannelId: channelId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as IHrConfig;
        this.invalidate(guildId);
        return config;
    }

    static async addShortcutRole(guildId: string, roleId: string): Promise<IHrConfig> {
        const config = await HrConfig.findOneAndUpdate(
            { guildId },
            { $addToSet: { staffWarnShortcutRoleIds: roleId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as IHrConfig;
        this.invalidate(guildId);
        return config;
    }

    static async removeShortcutRole(guildId: string, roleId: string): Promise<IHrConfig> {
        const config = await HrConfig.findOneAndUpdate(
            { guildId },
            { $pull: { staffWarnShortcutRoleIds: roleId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as IHrConfig;
        this.invalidate(guildId);
        return config;
    }
}
