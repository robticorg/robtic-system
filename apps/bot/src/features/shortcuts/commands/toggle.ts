import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { ShortcutRepository } from "@database/repositories";
import { resolveTrigger } from "../utils/resolve-trigger";

import { L } from "@utils";
/** Pauses a shortcut without losing its arguments and restrictions. */
export const toggle: FeatureSubcommandHandler = async (interaction, _client) => {
    const trigger = await resolveTrigger(interaction.guildId!, interaction.options.getString("trigger", true));
    const enabled = interaction.options.getBoolean("enabled", true);

    const shortcut = await ShortcutRepository.setEnabled(interaction.guildId!, trigger, enabled);

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setColor(shortcut ? COLORS.success : COLORS.error)
            .setDescription(shortcut
                ? L(`**${shortcut.trigger}** is now **${enabled ? "enabled" : "disabled"}**.`, `**${shortcut.trigger}** صار **${enabled ? "مفعّل" : "مقفل"}**.`)
                : L(`No shortcut called **${trigger}**.`, `ما في اختصار اسمه **${trigger}**.`))],
    });
};
