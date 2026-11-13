import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { ActivityRepository } from "@database/repositories";
import { COLORS } from "@constants";
import { levelProgress } from "@core/xp";

import { L } from "@utils";
export default {
    scope: "guild",
    access: "general",
    category: "Leveling",
    data: new SlashCommandBuilder()
        .setName("level")
        .setDescription("Check your level and XP")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User to check (defaults to you)")
        ),

    async run(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();

        const target = interaction.options.getUser("user") ?? interaction.user;
        const guildId = interaction.guildId!;

        const record = await ActivityRepository.findOrCreate(target.id, guildId, target.username);
        const rank = await ActivityRepository.getRank(target.id, guildId);
        const message = levelProgress(record.messageXP ?? 0);
        const voice = levelProgress(record.voiceXP ?? 0);
        const line = (p: ReturnType<typeof levelProgress>) => `${generateBar(p.progress, p.needed)} ${p.progress}/${p.needed}`;

        const embed = new EmbedBuilder()
            .setTitle(L(`${target.username}'s level`, `مستوى ${target.username}`))
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: L("💬 Message level", "💬 مستوى الرسائل"), value: `**${message.level}** · ${record.messageXP ?? 0} XP\n${line(message)}`, inline: true },
                { name: L("🎙️ Voice level", "🎙️ مستوى الصوت"), value: `**${voice.level}** · ${record.voiceXP ?? 0} XP\n${line(voice)}`, inline: true },
                { name: L("Total XP", "مجموع الخبرة"), value: L(`${record.totalXP} · Rank #${rank}`, `${record.totalXP} · الترتيب #${rank}`), inline: false },
                { name: L("Messages", "الرسائل"), value: `${record.messageCount}`, inline: true },
            )
            .setColor(COLORS.activity)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};

function generateBar(current: number, max: number): string {
    const total = 10;
    const filled = max > 0 ? Math.round((current / max) * total) : 0;
    return "█".repeat(filled) + "░".repeat(total - filled);
}
