import { ButtonInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import type { AdSection } from "@database/models/AdsConfig";
import { addToCart } from "../utils/cartStore";

export default {
    customId: /^ads-cart-add_/,

    async run(interaction: ButtonInteraction, client: BotClient) {
        const [, section, key] = interaction.customId.match(/^ads-cart-add_(\w+)_(.+)$/) ?? [];
        const config = await AdsConfigRepository.get(interaction.guildId!);
        const item = AdsConfigRepository.findItem(config, section as AdSection, key);

        if (!item) {
            await interaction.reply({ content: "❌ This item no longer exists.", flags: MessageFlags.Ephemeral });
            return;
        }

        addToCart(interaction.user.id, { section: section as AdSection, key: item.key, name: item.name, priceUsd: item.priceUsd });

        await interaction.reply({
            content: `✅ تمت إضافة **${item.name}** إلى سلتك.`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
