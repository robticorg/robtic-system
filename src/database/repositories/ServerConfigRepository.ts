import { ServerConfig, type IServerConfig, type ISentPanel, type IShortcut, type IServerRoles } from "@database/models/ServerConfig";

export class ServerConfigRepository {
    static async find(guildId: string): Promise<IServerConfig | null> {
        return ServerConfig.findOne({ guildId });
    }

    static async findOrCreate(guildId: string): Promise<IServerConfig> {
        let config = await ServerConfig.findOne({ guildId });
        if (!config) {
            config = await ServerConfig.create({ guildId, sentPanels: [], shortcuts: [] });
        }
        return config;
    }

    static async setRole(guildId: string, type: keyof IServerRoles, roleId: string): Promise<IServerConfig> {
        return ServerConfig.findOneAndUpdate(
            { guildId },
            { $set: { [`roles.${type}`]: roleId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as Promise<IServerConfig>;
    }

    static async getRole(guildId: string, type: keyof IServerRoles): Promise<string | null> {
        const config = await ServerConfig.findOne({ guildId });
        return config?.roles?.[type] ?? null;
    }

    static async setModmailChannel(guildId: string, channelId: string): Promise<IServerConfig> {
        return ServerConfig.findOneAndUpdate(
            { guildId },
            { $set: { modmailChannelId: channelId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as Promise<IServerConfig>;
    }

    static async getModmailChannel(guildId: string): Promise<string | null> {
        const config = await ServerConfig.findOne({ guildId });
        return config?.modmailChannelId ?? null;
    }

    static async setLineChannel(guildId: string, channelId: string): Promise<IServerConfig> {
        return ServerConfig.findOneAndUpdate(
            { guildId },
            { $set: { lineChannelId: channelId } },
            { upsert: true, returnDocument: "after", new: true }
        ) as Promise<IServerConfig>;
    }

    static async getLineChannel(guildId: string): Promise<string | null> {
        const config = await ServerConfig.findOne({ guildId });
        return config?.lineChannelId ?? null;
    }

    static async addShortcut(guildId: string, command: string, trigger: string): Promise<IServerConfig> {
        const config = await this.findOrCreate(guildId);
        // Avoid duplicates for same trigger
        const exists = config.shortcuts.find(s => s.trigger === trigger);
        if (exists) {
            exists.command = command; // Update existing
        } else {
            config.shortcuts.push({ command, trigger });
        }
        return config.save();
    }

    static async removeShortcut(guildId: string, trigger: string): Promise<IServerConfig | null> {
        return ServerConfig.findOneAndUpdate(
            { guildId },
            { $pull: { shortcuts: { trigger } } },
            { returnDocument: "after" }
        );
    }

    static async getShortcuts(guildId: string): Promise<IShortcut[]> {
        const config = await this.findOrCreate(guildId);
        return config.shortcuts || [];
    }

    static async addSentPanel(
        guildId: string,
        panel: Omit<ISentPanel, "guildId">
    ): Promise<IServerConfig> {
        const config = await this.findOrCreate(guildId);
        config.sentPanels.push({ ...panel, guildId });
        return config.save();
    }

    static async removeSentPanel(guildId: string, messageId: string): Promise<IServerConfig | null> {
        return ServerConfig.findOneAndUpdate(
            { guildId },
            { $pull: { sentPanels: { messageId } } },
            { returnDocument: "after" }
        );
    }

    static async getSentPanels(guildId: string): Promise<ISentPanel[]> {
        const config = await ServerConfig.findOne({ guildId });
        return config?.sentPanels ?? [];
    }

    static async getSentPanel(guildId: string, messageId: string): Promise<ISentPanel | undefined> {
        const config = await ServerConfig.findOne({ guildId });
        return config?.sentPanels.find(p => p.messageId === messageId);
    }

    static async getSentPanelByKey(guildId: string, panelKey: string): Promise<ISentPanel | undefined> {
        const config = await ServerConfig.findOne({ guildId });
        return config?.sentPanels.find(p => p.panelKey === panelKey);
    }

    static async upsertSentPanel(
        guildId: string,
        panel: Omit<ISentPanel, "guildId">
    ): Promise<IServerConfig> {
        const config = await this.findOrCreate(guildId);
        const index = config.sentPanels.findIndex((p) => p.panelKey === panel.panelKey);

        if (index >= 0) {
            config.sentPanels[index] = { ...panel, guildId };
        } else {
            config.sentPanels.push({ ...panel, guildId });
        }

        return config.save();
    }

    static async getAllSentPanelsByKey(panelKey: string): Promise<ISentPanel[]> {
        const configs = await ServerConfig.find(
            { "sentPanels.panelKey": panelKey },
            { sentPanels: 1 }
        ).lean();

        const panels: ISentPanel[] = [];

        for (const config of configs) {
            for (const panel of config.sentPanels ?? []) {
                if (panel.panelKey === panelKey) {
                    panels.push(panel as ISentPanel);
                }
            }
        }

        return panels;
    }
}
