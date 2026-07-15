import { SlashCommandBuilder, ChatInputCommandInteraction, type GuildMember } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { buildStatusEmbed } from "../utils/comboEmbeds";
import { buildComboNavRow, isComboAdmin } from "../utils/comboComponents";

export default {
    data: new SlashCommandBuilder()
        .setName("combo")
        .setDescription("View your conversation combo status"),

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply();

        const guild = interaction.guild;
        if (!guild) {
            await interaction.editReply({ content: "لا يمكن استخدام هذا الأمر إلا داخل سيرفر." });
            return;
        }

        const member = interaction.member as GuildMember | null;
        const isAdmin = await isComboAdmin(interaction.user.id, member);

        const embed = await buildStatusEmbed(guild, {
            id: interaction.user.id,
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ size: 256 }),
        });

        const nav = buildComboNavRow(interaction.user.id, isAdmin);

        await interaction.editReply({ embeds: [embed], components: [nav] });
    },
};
