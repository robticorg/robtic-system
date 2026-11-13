import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { ShortcutRepository } from "@database/repositories";
import { resolveTrigger } from "../utils/resolve-trigger";
import { buildShortcutInfoEmbed } from "../utils/build-shortcut-embed";

import { L } from "@utils";
export const info: FeatureSubcommandHandler = async (interaction, _client) => {
    const trigger = await resolveTrigger(interaction.guildId!, interaction.options.getString("trigger", true));
    const shortcut = await ShortcutRepository.find(interaction.guildId!, trigger);

    if (!shortcut) {
        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(COLORS.error).setDescription(L(`No shortcut called **${trigger}**.`, `ما في اختصار اسمه **${trigger}**.`))],
        });
        return;
    }

    await interaction.editReply({ embeds: [buildShortcutInfoEmbed(shortcut)] });
};
