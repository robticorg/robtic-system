import {
    ActionRowBuilder,
    EmbedBuilder,
    StringSelectMenuBuilder,
    type TextChannel,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { ISubmitConfig } from "@database/models/SubmitConfig";
import { Colors } from "@core/config";
import { SubmissionTypeRepository } from "@database/repositories";

export async function updatePanel(client: BotClient, config: ISubmitConfig): Promise<void> {
    if (!config.panelChannelId || !config.panelMessageId) return;

    const channel = client.channels.cache.get(config.panelChannelId) as TextChannel | undefined;
    if (!channel) return;

    const message = await channel.messages.fetch(config.panelMessageId).catch(() => null);
    if (!message) return;

    const allTypes = await SubmissionTypeRepository.list(config.guildId);
    const openTypes = allTypes.filter(t => t.isOpen);

    const embed = new EmbedBuilder()
        .setTitle("📋 Staff Applications")
        .setTimestamp();

    if (!openTypes.length) {
        embed
            .setDescription("No submission types are currently open for applications.\nCheck back later!")
            .setColor(Colors.error);

        await message.edit({ embeds: [embed], components: [] });
        return;
    }

    embed
        .setDescription("Select a submission type below to apply.\nMake sure to read the requirements before applying.")
        .setColor(Colors.success)
        .addFields(
            openTypes.map(t => ({
                name: `📋 ${t.name}`,
                value: "✅ Open",
                inline: true,
            }))
        );

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("staff-apply-select")
        .setPlaceholder("Select where to apply...")
        .addOptions(
            openTypes.map(t => ({
                label: t.name,
                value: t.key,
                emoji: "📋",
            }))
        );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    await message.edit({ embeds: [embed], components: [row] });
}
