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
            .setTitle(`🔥 التتابع — ${target.username}`)
            .setThumbnail(target.displayAvatarURL({ size: 256 }))
            .setColor(record.active ? Colors.activity : Colors.info)
            .addFields(
                { name: "التتابع الحالي", value: `🔥 ${record.currentStreak}`, inline: true },
                { name: "أفضل تتابع", value: `🏆 ${record.bestStreak}`, inline: true },
                { name: "الترتيب", value: rank > 0 ? `📈 #${rank}` : "غير مصنف", inline: true },
                { name: "التتابع القادم", value: nextClaimMs > 0 ? `⏳ ${formatDuration(nextClaimMs)}` : "✅ متاح الآن!", inline: true },
                { name: "ينتهي خلال", value: expiresInMs !== null ? `💔 ${formatDuration(expiresInMs)}` : "غير متاح", inline: true },
                { name: "التذكير", value: record.active ? (record.reminderSent ? "تم الإرسال" : "قيد الانتظار") : "غير متاح", inline: true },
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
