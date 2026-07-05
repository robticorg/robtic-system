import { StringSelectMenuInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import { addToCart, getCart } from "../utils/cartStore";
import { buildCartSummary } from "../utils/adsPanels";

export default {
    customId: "ads-select-addon",

    async run(interaction: StringSelectMenuInteraction, client: BotClient) {
        const key = interaction.values[0];
        const config = await AdsConfigRepository.get(interaction.guildId!);
        const item = AdsConfigRepository.findItem(config, "addons", key);

        if (!item) {
            await interaction.reply({ content: "❌ This add-on no longer exists.", flags: MessageFlags.Ephemeral });
            return;
        }

        addToCart(interaction.user.id, { section: "addons", key: item.key, name: item.name, priceUsd: item.priceUsd });
        const cart = getCart(interaction.user.id);

        await interaction.reply({
            ...buildCartSummary(cart, config.exchangeRate, `✅ Added **${item.name}** to your cart.`),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
