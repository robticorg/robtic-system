import {
    type StringSelectMenuInteraction,
    type ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ComponentHandler } from "@core/config";
import { Colors } from "@core/config";
import { LOG_REGISTRY, type LogKey } from "@shared/config/log-registry";
import { LogConfigRepository } from "@database/repositories";

export const setupLogSelectHandler: ComponentHandler<StringSelectMenuInteraction> = {
    customId: /^setup_log_select$/,

    async run(interaction: StringSelectMenuInteraction, client: BotClient) {
        const key = interaction.values[0] as LogKey;
        const meta = LOG_REGISTRY[key];

        const existing = await LogConfigRepository.findByKey(key);
        if (existing) {
            const guild = client.guilds.cache.get(existing.serverId);
            const channelMention = `<#${existing.channelId}>`;

            const embed = new EmbedBuilder()
                .setTitle("⚠️ Log Already Configured")
                .setColor(Colors.warning)
                .setDescription(
                    `**${meta.label}** is already configured.\n\n` +
                    `**Server:** ${guild?.name ?? existing.serverId}\n` +
                    `**Channel:** ${channelMention}`
                )
                .setTimestamp();

            const overrideBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`setup_log_override_${key}`)
                    .setLabel("Override")
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji("⚠️"),
            );

            await interaction.update({ embeds: [embed], components: [overrideBtn], content: null });
            return;
        }

        await showSetupLogModal(interaction, key);
    },
};

export const setupLogOverrideHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^setup_log_override_.+$/,

    async run(interaction: ButtonInteraction, _client: BotClient) {
        const key = interaction.customId.replace("setup_log_override_", "") as LogKey;
        await showSetupLogModal(interaction, key);
    },
};

async function showSetupLogModal(
    interaction: StringSelectMenuInteraction | ButtonInteraction,
    key: LogKey,
): Promise<void> {
    const meta = LOG_REGISTRY[key];

    const modal = new ModalBuilder()
        .setCustomId(`setup_log_modal_${key}`)
        .setTitle(`Setup: ${meta.label}`);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId("channel_id")
                .setLabel("Channel ID")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder("Enter the channel ID (numbers only)")
                .setMinLength(17)
                .setMaxLength(20)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
                .setCustomId("server_id")
                .setLabel("Server ID (optional — defaults to this server)")
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setPlaceholder("Leave empty to use this server")
                .setMinLength(17)
                .setMaxLength(20)
        ),
    );

    await interaction.showModal(modal);
}
