import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
} from "discord.js";
import { ActivityRepository } from "@database/repositories";
import { COLORS } from "@constants";

import { L } from "@utils";
export default {
    scope: "guild",
    access: "general",
    category: "Leveling",
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("View the XP leaderboard")
        .addIntegerOption(option =>
            option
                .setName("page")
                .setDescription("Page number")
                .setMinValue(1)
        ),

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const page = Math.max(1, Math.floor(interaction.options.getInteger("page") ?? 1));
        const perPage = 10;
        const guildId = interaction.guildId!;

        const top = await ActivityRepository.getLeaderboard(guildId, perPage * page);
        const pageData = top.slice((page - 1) * perPage);

        if (pageData.length === 0) {
            await interaction.deleteReply().catch(() => {});
            await interaction.followUp({ content: L("No data for this page.", "ما في بيانات في هذي الصفحة."), flags: MessageFlags.Ephemeral });
            return;
        }

        const lines = pageData.map((user, i) => {
            const rank = (page - 1) * perPage + i + 1;
            return L(`**${rank}.** <@${user.discordId}> — 💬 Lv ${user.messageLevel ?? 0} · 🎙️ Lv ${user.voiceLevel ?? 0} | ${user.totalXP} XP`, `**${rank}.** <@${user.discordId}> — 💬 مستوى ${user.messageLevel ?? 0} · 🎙️ مستوى ${user.voiceLevel ?? 0} | ${user.totalXP} خبرة`);
        });

        const embed = new EmbedBuilder()
            .setTitle(L("🏆 XP leaderboard", "🏆 توب الخبرة"))
            .setDescription(lines.join("\n"))
            .setColor(COLORS.activity)
            .setFooter({ text: L(`Page ${page}`, `صفحة ${page}`) })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
