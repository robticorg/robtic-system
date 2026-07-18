import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    type GuildMember,
} from "discord.js";
import type { BotClient } from "@core/BotClient";
import { StreakRepository, StreakRecoveryRepository } from "@database/repositories";
import { Colors, STREAK_CONFIG } from "@core/config";
import { applyStreakRole } from "../utils/streakRole";
import { getUserLang, t } from "@shared/utils/lang";

export default {
    data: new SlashCommandBuilder()
        .setName("streak-return")
        .setDescription("Recover your last streak, if it broke recently"),

    async run(interaction: ChatInputCommandInteraction, _client: BotClient) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.guildId!;
        const userId = interaction.user.id;
        const lang = await getUserLang(interaction.member as GuildMember | null);

        const recovery = await StreakRecoveryRepository.find(userId, guildId);
        if (!recovery) {
            await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(t("streak.return_nothing", lang)).setColor(Colors.info)] });
            return;
        }

        const withinWindow = Date.now() - recovery.expiredAt.getTime() <= STREAK_CONFIG.recoveryWindowMs;
        if (!withinWindow) {
            await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(t("streak.return_expired", lang)).setColor(Colors.warning)] });
            return;
        }

        const current = await StreakRepository.findOrCreate(userId, guildId, interaction.user.username);

        if (recovery.currentStreak <= current.currentStreak) {
            await interaction.editReply({
                embeds: [new EmbedBuilder().setDescription(
                    t("streak.return_not_needed", lang, { current: `${current.currentStreak}`, last: `${recovery.currentStreak}` })
                ).setColor(Colors.info)],
            });
            return;
        }

        const bestStreak = Math.max(recovery.bestStreak, current.bestStreak);
        await StreakRepository.restore(userId, guildId, recovery.currentStreak, bestStreak);
        await StreakRecoveryRepository.delete(userId, guildId);

        const member = interaction.guild?.members.cache.get(userId) ?? await interaction.guild?.members.fetch(userId).catch(() => null);
        if (member) await applyStreakRole(member, recovery.currentStreak).catch(() => null);

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setDescription(t("streak.return_success", lang, { streak: `${recovery.currentStreak}` }))
                .setColor(Colors.success)],
        });
    },
};
