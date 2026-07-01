import {
    type ModalSubmitInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ComponentHandler } from "@core/config";
import { Colors } from "@core/config";
import { LOG_REGISTRY, type LogKey } from "@shared/config/log-registry";
import { LogConfigRepository } from "@database/repositories";

const setupLogModalHandler: ComponentHandler<ModalSubmitInteraction> = {
    customId: /^setup_log_modal_.+$/,

    async run(interaction: ModalSubmitInteraction, client: BotClient) {
        const key = interaction.customId.replace("setup_log_modal_", "") as LogKey;
        const meta = LOG_REGISTRY[key];

        const channelId = interaction.fields.getTextInputValue("channel_id").trim();
        const rawServerId = interaction.fields.getTextInputValue("server_id")?.trim();
        const serverId = rawServerId || interaction.guildId!;

        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            await interaction.reply({
                embeds: [new EmbedBuilder().setDescription(`❌ Bot is not in server \`${serverId}\`.`).setColor(Colors.error)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel?.isTextBased()) {
            await interaction.reply({
                embeds: [new EmbedBuilder().setDescription(`❌ Channel \`${channelId}\` not found or is not a text channel in **${guild.name}**.`).setColor(Colors.error)],
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const previous = await LogConfigRepository.findByKey(key);
        await LogConfigRepository.upsert(key, serverId, channelId, interaction.user.id);

        const embed = new EmbedBuilder()
            .setTitle(previous ? "🔄 Log Channel Updated" : "✅ Log Channel Configured")
            .setColor(Colors.success)
            .addFields(
                { name: "Log Type", value: meta.label, inline: true },
                { name: "Server", value: guild.name, inline: true },
                { name: "Channel", value: `<#${channelId}>`, inline: true },
            );

        if (previous) {
            const prevGuild = client.guilds.cache.get(previous.serverId);
            embed.addFields({
                name: "Previous",
                value: `${prevGuild?.name ?? previous.serverId} — <#${previous.channelId}>`,
                inline: false,
            });
        }

        embed.setTimestamp();

        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    },
};

export default setupLogModalHandler;
