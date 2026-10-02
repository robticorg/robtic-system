import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from "discord.js";
import { ActivityRepository } from "@database/repositories";
import { COLORS } from "@constants";
import { levelProgress } from "@core/xp";

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
            .setTitle(`${target.username}'s Level`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: "💬 Message Level", value: `**${message.level}** · ${record.messageXP ?? 0} XP\n${line(message)}`, inline: true },
                { name: "🎙️ Voice Level", value: `**${voice.level}** · ${record.voiceXP ?? 0} XP\n${line(voice)}`, inline: true },
                { name: "Total XP", value: `${record.totalXP} · Rank #${rank}`, inline: false },
                { name: "Messages", value: `${record.messageCount}`, inline: true },
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
