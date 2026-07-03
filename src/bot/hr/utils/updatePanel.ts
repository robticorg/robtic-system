import {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    type TextChannel,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ISubmitConfig } from "@database/models/SubmitConfig";
import { Colors } from "@core/config";
import { departments } from "../config/departments";

const DEPT_EMOJI: Record<string, string> = {
    Dev: "💻",
    Design: "🎨",
    Moderation: "🛡️",
    Community: "💬",
    Events: "🎉",
    Support: "🎫",
    HR: "👥",
};

export async function updatePanel(client: BotClient, config: ISubmitConfig): Promise<void> {
    if (!config.panelChannelId || !config.panelMessageId) return;

    const channel = client.channels.cache.get(config.panelChannelId) as TextChannel | undefined;
    if (!channel) return;

    const message = await channel.messages.fetch(config.panelMessageId).catch(() => null);
    if (!message) return;

    const openDepts = departments.filter(d => config.openDepartments.includes(d.name));

    const embed = new EmbedBuilder()
        .setTitle("📋 Staff Applications")
        .setTimestamp();

    if (!openDepts.length) {
        embed
            .setDescription("No departments are currently open for applications.\nCheck back later!")
            .setColor(Colors.error);

        await message.edit({ embeds: [embed], components: [] });
        return;
    }

    embed
        .setDescription("Select a department below to submit your application.\nMake sure to read the requirements before applying.")
        .setColor(Colors.success)
        .addFields(
            openDepts.map(d => ({
                name: `${DEPT_EMOJI[d.name] ?? "📋"} ${d.name}`,
                value: "✅ Open",
                inline: true,
            }))
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("staff-apply-select")
        .setPlaceholder("Select a department to apply...")
        .addOptions(
            openDepts.map(d => ({
                label: `${d.name} Department`,
                value: d.name,
                emoji: DEPT_EMOJI[d.name] ?? "📋",
            }))
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    await message.edit({ embeds: [embed], components: [row] });
}
