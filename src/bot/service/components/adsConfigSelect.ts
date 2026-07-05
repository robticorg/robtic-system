import { StringSelectMenuInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import type { AdSection } from "@database/models/AdsConfig";
import { buildItemDetail } from "../utils/adsConfigViews";

export default {
    customId: "ads-config-select-item",

    async run(interaction: StringSelectMenuInteraction, client: BotClient) {
        const [section, key] = interaction.values[0].split(":") as [AdSection, string];
        const config = await AdsConfigRepository.get(interaction.guildId!);
        const item = AdsConfigRepository.findItem(config, section, key);

        if (!item) {
            await interaction.reply({ content: "❌ This item no longer exists.", flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.update({
            ...buildItemDetail(section, item, config.exchangeRate),
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
