import { ButtonInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import { buildPackageDetail } from "../utils/adsPanels";

export default {
    customId: /^ads-pack_/,

    async run(interaction: ButtonInteraction, client: BotClient) {
        const key = interaction.customId.slice("ads-pack_".length);
        const config = await AdsConfigRepository.get(interaction.guildId!);
        const item = AdsConfigRepository.findItem(config, "packages", key);

        if (!item) {
            await interaction.reply({ content: "❌ This package no longer exists.", flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.reply({
            ...buildPackageDetail(item, config.exchangeRate),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
