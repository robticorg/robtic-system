import type { ClientManager } from "@core/client-manager";
import { COLORS } from "@constants";
import { buildSystemStatusEmbed, configureStatusPanel, getConfiguredStatusPanel, registerStatusClient } from "@core/status/status";
import { L, formatDuration } from "@utils";
import { EmbedBuilder, type ChatInputCommandInteraction } from "discord.js";

export async function systemStatus(interaction: ChatInputCommandInteraction, manager: ClientManager) {
    await interaction.deferReply();
    registerStatusClient(interaction.client);

    const selectedChannel = interaction.options.getChannel("channel");

    if (selectedChannel) {
        if (!interaction.guildId) {
            await interaction.editReply({ content: L("This command can only be used in a server.", "هذا الأمر يعمل داخل السيرفر فقط.") });
            return;
        }

        try {
            await configureStatusPanel(interaction.guildId, selectedChannel.id, interaction.user.id, interaction.client);
            await interaction.editReply({
                content: L(`✅ Status panel set in <#${selectedChannel.id}>. It updates by itself.`, `✅ تم ضبط لوحة الحالة في <#${selectedChannel.id}>. تتحدث تلقائياً.`),
            });
        } catch (error) {
            await interaction.editReply({
                content: L(`❌ Couldn't set the status panel: ${String(error)}`, `❌ ما قدرت أضبط لوحة الحالة: ${String(error)}`),
            });
        }
        return;
    }

    if (interaction.guildId) {
        const configuredPanel = await getConfiguredStatusPanel(interaction.guildId);
        if (!configuredPanel) {
            await interaction.editReply({
                content: L("No status channel yet. Use `/system status channel:#your-channel` first.", "ما في روم حالة. استخدم `/system status channel:#الروم` أول."),
            });
            return;
        }

        const liveEmbed = await buildSystemStatusEmbed();
        await interaction.editReply({
            content: L(`Current status panel: <#${configuredPanel.channelId}>`, `لوحة الحالة الحالية: <#${configuredPanel.channelId}>`),
            embeds: [liveEmbed],
        });
        return;
    }

    const status = manager.getStatus();

    const embed = new EmbedBuilder()
        .setTitle(L("🖥️ System status", "🖥️ حالة النظام"))
        .setColor(COLORS.info)
        .setTimestamp()
        .addFields({
            name: `${status.online ? "🟢" : "🔴"} ${status.name.toUpperCase()}`,
            value: [
                `Status: ${status.online ? "Online" : "Offline"}`,
                `Ping: ${status.ping}ms`,
                `Guilds: ${status.guilds}`,
                `Uptime: ${status.uptime ? formatDuration(status.uptime) : "N/A"}`,
                `Commands: ${status.commands}`,
            ].join("\n"),
            inline: true,
        });

    await interaction.editReply({ embeds: [embed] });
}
