import { SubmitConfig, type ISubmitConfig } from "@database/models/SubmitConfig";

export class SubmitConfigRepository {
    static async get(guildId: string): Promise<ISubmitConfig | null> {
        return SubmitConfig.findOne({ guildId });
    }

    static async setReviewChannel(guildId: string, channelId: string): Promise<ISubmitConfig> {
        return SubmitConfig.findOneAndUpdate(
            { guildId },
            { $set: { reviewChannelId: channelId } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ) as Promise<ISubmitConfig>;
    }

    static async setPanel(guildId: string, channelId: string, messageId: string): Promise<ISubmitConfig> {
        return SubmitConfig.findOneAndUpdate(
            { guildId },
            { $set: { panelChannelId: channelId, panelMessageId: messageId } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        ) as Promise<ISubmitConfig>;
    }

    static async openDepartment(guildId: string, department: string): Promise<ISubmitConfig | null> {
        return SubmitConfig.findOneAndUpdate(
            { guildId },
            { $addToSet: { openDepartments: department } },
            { upsert: true, new: true, setDefaultsOnInsert: true },
        );
    }

    static async closeDepartment(guildId: string, department: string): Promise<ISubmitConfig | null> {
        return SubmitConfig.findOneAndUpdate(
            { guildId },
            { $pull: { openDepartments: department } },
            { new: true },
        );
    }
}
