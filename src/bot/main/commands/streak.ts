import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { Colors } from "@core/config";
import { formatDuration } from "@core/utils";
import { getStreakSummary } from "../services/streak-service";

export default {
    data: new SlashCommandBuilder()
        .setName("streak")
        .setDescription("View your (or another member's) daily streak")
        .addUserOption(opt =>
            opt.setName("user").setDescription("The user to view (defaults to yourself)").setRequired(false)
        ),

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply();

        const target = interaction.options.getUser("user") ?? interaction.user;
        const guildId = interaction.guildId!;

        const summary = await getStreakSummary(target.id, guildId, target.username);
        const { record, rank, expiresInMs, nextClaimMs } = summary;

        const embed = new EmbedBuilder()
            .setTitle(`🔥 Streak — ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setColor(record.active ? Colors.activity : Colors.info)
            .addFields(
                { name: "Current Streak", value: `🔥 ${record.currentStreak}`, inline: true },
                { name: "Best Streak", value: `🏆 ${record.bestStreak}`, inline: true },
                { name: "Rank", value: rank > 0 ? `📈 #${rank}` : "Unranked", inline: true },
                { name: "Next Streak", value: nextClaimMs > 0 ? `⏳ ${formatDuration(nextClaimMs)}` : "✅ Available now!", inline: true },
                { name: "Expires In", value: expiresInMs !== null ? `💔 ${formatDuration(expiresInMs)}` : "N/A", inline: true },
                { name: "Reminder", value: record.active ? (record.reminderSent ? "Sent" : "Pending") : "N/A", inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
