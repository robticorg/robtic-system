import { StringSelectMenuInteraction, MessageFlags } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { AdsConfigRepository } from "@database/repositories";
import { addToCart } from "../utils/cartStore";

export default {
    customId: "ads-select-addon",

    async run(interaction: StringSelectMenuInteraction, client: BotClient) {
        const config = await AdsConfigRepository.get(interaction.guildId!);
        const items = interaction.values
            .map(key => AdsConfigRepository.findItem(config, "addons", key))
            .filter((item): item is NonNullable<typeof item> => Boolean(item));

        if (!items.length) {
            await interaction.reply({ content: "❌ These add-ons no longer exist.", flags: MessageFlags.Ephemeral });
            return;
        }

        for (const item of items) {
            addToCart(interaction.user.id, { section: "addons", key: item.key, name: item.name, priceUsd: item.priceUsd });
        }
        const names = items.map(i => `**${i.name}**`).join("، ");

        await interaction.reply({
            content: `✅ تمت إضافة ${names} إلى سلتك.`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
