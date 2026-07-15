import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { getLeaderboard, buildLeaderboardEmbed, type LeaderboardMode } from "../services/streak-service";

export function buildStreakTopButtons(activeMode: LeaderboardMode): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("streak-top-current")
            .setLabel("الحالي")
            .setEmoji("🔥")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(activeMode === "current"),
        new ButtonBuilder()
            .setCustomId("streak-top-best")
            .setLabel("الأفضل على الإطلاق")
            .setEmoji("🏆")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(activeMode === "best"),
    );
}

export default {
    data: new SlashCommandBuilder()
        .setName("streak-top")
        .setDescription("View the top 5 daily streaks"),

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply();

        const guildId = interaction.guildId!;
        const records = await getLeaderboard(guildId, "current");
        const embed = buildLeaderboardEmbed(interaction.guild!.name, "current", records);

        await interaction.editReply({ embeds: [embed], components: [buildStreakTopButtons("current")] });
    },
};
