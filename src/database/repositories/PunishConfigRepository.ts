import { PunishConfig, type IPunishConfig } from "@database/models/PunishConfig";

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { config: IPunishConfig; expiresAt: number }>();

export class PunishConfigRepository {
    static async findOrCreate(guildId: string): Promise<IPunishConfig> {
        let config = await PunishConfig.findOne({ guildId });
        if (!config) {
            config = await PunishConfig.create({ guildId });
        }
        return config;
    }

    /** Hot-path entry point — read on every guild message by the punish-shortcut listener. */
    static async getCached(guildId: string): Promise<IPunishConfig> {
        const cached = cache.get(guildId);
        if (cached && cached.expiresAt > Date.now()) return cached.config;

        const config = await this.findOrCreate(guildId);
        cache.set(guildId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
        return config;
    }

    static invalidate(guildId: string): void {
        cache.delete(guildId);
    }

    static async addShortcutRole(guildId: string, roleId: string): Promise<IPunishConfig> {
        const config = await PunishConfig.findOneAndUpdate(
            { guildId },
            { $addToSet: { shortcutRoleIds: roleId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as IPunishConfig;
        this.invalidate(guildId);
        return config;
    }

    static async removeShortcutRole(guildId: string, roleId: string): Promise<IPunishConfig> {
        const config = await PunishConfig.findOneAndUpdate(
            { guildId },
            { $pull: { shortcutRoleIds: roleId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as IPunishConfig;
        this.invalidate(guildId);
        return config;
    }

    static async setPointsPerAction(guildId: string, points: number): Promise<IPunishConfig> {
        const config = await PunishConfig.findOneAndUpdate(
            { guildId },
            { $set: { pointsPerAction: points } },
            { upsert: true, returnDocument: "after", new: true }
        ) as IPunishConfig;
        this.invalidate(guildId);
        return config;
    }

    static async setProofChannel(guildId: string, channelId: string): Promise<IPunishConfig> {
        const config = await PunishConfig.findOneAndUpdate(
            { guildId },
            { $set: { proofChannelId: channelId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as IPunishConfig;
        this.invalidate(guildId);
        return config;
    }
}
