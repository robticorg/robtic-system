import { XPSettings, type IXPSettings } from "@database/models/XPSettings";

export class XPSettingsRepository {
    static async get(guildId: string): Promise<IXPSettings | null> {
        return XPSettings.findOne({ guildId });
    }

    static async getOrCreate(guildId: string): Promise<IXPSettings> {
        let settings = await XPSettings.findOne({ guildId });
        if (!settings) {
            settings = await XPSettings.create({ guildId });
        }
        return settings;
    }

    static async setDecayEnabled(guildId: string, enabled: boolean): Promise<IXPSettings> {
        return XPSettings.findOneAndUpdate(
            { guildId },
            { decayEnabled: enabled },
            { upsert: true, returnDocument: "after" }
        );
    }

    static async addExcludedChannel(guildId: string, channelId: string): Promise<IXPSettings> {
        return XPSettings.findOneAndUpdate(
            { guildId },
            { $addToSet: { excludedChannels: channelId } },
            { upsert: true, returnDocument: "after" }
        );
    }

    static async removeExcludedChannel(guildId: string, channelId: string): Promise<IXPSettings> {
        return XPSettings.findOneAndUpdate(
            { guildId },
            { $pull: { excludedChannels: channelId } },
            { upsert: true, returnDocument: "after" }
        );
    }

    static async addSupportChannel(guildId: string, channelId: string): Promise<IXPSettings> {
        return XPSettings.findOneAndUpdate(
            { guildId },
            { $addToSet: { supportChannels: channelId } },
            { upsert: true, returnDocument: "after" }
        );
    }

    static async removeSupportChannel(guildId: string, channelId: string): Promise<IXPSettings> {
        return XPSettings.findOneAndUpdate(
            { guildId },
            { $pull: { supportChannels: channelId } },
            { upsert: true, returnDocument: "after" }
        );
    }

    static async addStaffChannel(guildId: string, channelId: string): Promise<IXPSettings> {
        return XPSettings.findOneAndUpdate(
            { guildId },
            { $addToSet: { staffChannels: channelId } },
            { upsert: true, returnDocument: "after" }
        );
    }

    static async removeStaffChannel(guildId: string, channelId: string): Promise<IXPSettings> {
        return XPSettings.findOneAndUpdate(
            { guildId },
            { $pull: { staffChannels: channelId } },
            { upsert: true, returnDocument: "after" }
        );
    }

    /** Passing null clears it, which stops level-ups being announced publicly. */
    static async setLevelUpChannel(guildId: string, channelId: string | null): Promise<IXPSettings> {
        return XPSettings.findOneAndUpdate(
            { guildId },
            channelId ? { levelUpChannelId: channelId } : { $unset: { levelUpChannelId: "" } },
            { upsert: true, returnDocument: "after" }
        ) as Promise<IXPSettings>;
    }
}
