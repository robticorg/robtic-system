import { ButtonInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import { getCart } from "../utils/cartStore";
import { buildCartSummary } from "../utils/adsPanels";

export default {
    customId: "ads-cart-view",

    async run(interaction: ButtonInteraction, client: BotClient) {
        const config = await AdsConfigRepository.get(interaction.guildId!);
        const cart = getCart(interaction.user.id);

        await interaction.reply({
            ...buildCartSummary(cart, config.exchangeRate),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
