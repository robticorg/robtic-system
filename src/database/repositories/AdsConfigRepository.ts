import { AdsConfig, type IAdsConfig, type IAdItem, type AdSection } from "@database/models/AdsConfig";

const DEFAULT_SEED: Record<AdSection, IAdItem[]> = {
    standardAds: [
        { key: "here-mention", name: "@here Mention", priceUsd: 2, details: "1 × @here\nPosted once" },
        { key: "everyone-mention", name: "@everyone Mention", priceUsd: 5, details: "1 × @everyone\nPosted once" },
        { key: "online-broadcast", name: "Online Members Broadcast", priceUsd: 4, details: "Sent only to online members." },
        { key: "all-broadcast", name: "All Members Broadcast", priceUsd: 12, details: "Sent to all server members." },
    ],
    giveaway: [
        { key: "giveaway-1day", name: "1 Day Giveaway", priceUsd: 3, details: "Posted in the Giveaway channel." },
    ],
    packages: [
        {
            key: "iron",
            name: "🪨 Iron Pack",
            priceUsd: 6,
            details: "**Duration:** 1 Day\n\n**Includes:**\n• Dedicated advertisement channel\n• Giveaway (1 Day)\n• 1 × @here\n• Priority approval",
        },
        {
            key: "gold",
            name: "🥇 Gold Pack",
            priceUsd: 12,
            details: "**Duration:** 3 Days\n\n**Includes:**\n• Dedicated advertisement channel\n• Giveaway (3 Days)\n• 2 × @here\n• 1 × @everyone",
        },
        {
            key: "diamond",
            name: "💎 Diamond Pack",
            priceUsd: 20,
            details: "**Duration:** 7 Days\n\n**Includes:**\n• Dedicated advertisement channel\n• Giveaway (7 Days)\n• 5 × @here\n• 2 × @everyone",
        },
        {
            key: "emerald",
            name: "💚 Emerald Pack",
            priceUsd: 35,
            details: "**Duration:** 14 Days\n\n**Includes:**\n• Dedicated advertisement channel\n• Giveaway (14 Days)\n• 10 × @here\n• 5 × @everyone\n• 1 × Online Members Broadcast\n• 1 × All Members Broadcast\n• Highest priority",
        },
    ],
    addons: [
        { key: "extra-giveaway-day", name: "Extra Giveaway Day", priceUsd: 1 },
        { key: "extra-here", name: "Extra @here", priceUsd: 2 },
        { key: "extra-everyone", name: "Extra @everyone", priceUsd: 5 },
        { key: "extra-online-broadcast", name: "Extra Online Broadcast", priceUsd: 4 },
        { key: "extra-all-broadcast", name: "Extra All Members Broadcast", priceUsd: 12 },
        { key: "extend-package", name: "Extend Package (+1 Day)", priceUsd: 2 },
    ],
};

const SECTIONS: AdSection[] = ["standardAds", "giveaway", "packages", "addons"];

export class AdsConfigRepository {
    static async ensureDefaults(guildId: string): Promise<IAdsConfig> {
        const existing = await AdsConfig.findOne({ guildId });
        if (existing) return existing;

        return AdsConfig.create({
            guildId,
            exchangeRate: 12_500_000,
            standardAds: DEFAULT_SEED.standardAds,
            giveaway: DEFAULT_SEED.giveaway,
            packages: DEFAULT_SEED.packages,
            addons: DEFAULT_SEED.addons,
        });
    }

    static async get(guildId: string): Promise<IAdsConfig> {
        return this.ensureDefaults(guildId);
    }

    static async setApprovalChannel(guildId: string, channelId: string): Promise<IAdsConfig> {
        await this.ensureDefaults(guildId);
        return AdsConfig.findOneAndUpdate(
            { guildId },
            { $set: { approvalChannelId: channelId } },
            { new: true }
        ) as Promise<IAdsConfig>;
    }

    static async setPanel(guildId: string, channelId: string, messageId: string): Promise<IAdsConfig> {
        await this.ensureDefaults(guildId);
        return AdsConfig.findOneAndUpdate(
            { guildId },
            { $set: { panelChannelId: channelId, panelMessageId: messageId } },
            { new: true }
        ) as Promise<IAdsConfig>;
    }

    static async setExchangeRate(guildId: string, rate: number): Promise<IAdsConfig> {
        await this.ensureDefaults(guildId);
        return AdsConfig.findOneAndUpdate(
            { guildId },
            { $set: { exchangeRate: rate } },
            { new: true }
        ) as Promise<IAdsConfig>;
    }

    static findItem(config: IAdsConfig, section: AdSection, key: string): IAdItem | undefined {
        return config[section].find(i => i.key === key);
    }

    static allItems(config: IAdsConfig): { section: AdSection; item: IAdItem }[] {
        return SECTIONS.flatMap(section => config[section].map(item => ({ section, item })));
    }

    static async upsertItem(guildId: string, section: AdSection, item: IAdItem): Promise<IAdsConfig> {
        const config = await this.ensureDefaults(guildId);
        const list = config[section];
        const index = list.findIndex(i => i.key === item.key);

        if (index >= 0) list[index] = item;
        else list.push(item);

        config.markModified(section);
        await config.save();
        return config;
    }
}
