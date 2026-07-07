import { ButtonInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import { getCart, removeFromCart } from "../utils/cartStore";
import { buildCartSummary } from "../utils/adsPanels";

export default {
    customId: /^ads-cart-remove_/,

    async run(interaction: ButtonInteraction, client: BotClient) {
        const index = Number(interaction.customId.slice("ads-cart-remove_".length));
        removeFromCart(interaction.user.id, index);

        const config = await AdsConfigRepository.get(interaction.guildId!);
        await interaction.update({
            ...buildCartSummary(getCart(interaction.user.id), config.exchangeRate),
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
