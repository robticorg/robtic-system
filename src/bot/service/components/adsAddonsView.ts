import { ButtonInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import { buildAddonsSelector } from "../utils/adsPanels";

export default {
    customId: "ads-addons-view",

    async run(interaction: ButtonInteraction, client: BotClient) {
        const config = await AdsConfigRepository.get(interaction.guildId!);

        await interaction.reply({
            ...buildAddonsSelector(config),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
