import { EmbedBuilder, MessageFlags, type GuildMember } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { StreakRepository, StreakRecoveryRepository, StreakSettingsRepository } from "@database/repositories";
import { COLORS } from "@constants";
import { resolveStreakWindows } from "@core/streak";
import { canReturnStreaks } from "../functions/can-return-streaks";
import { applyStreakRole } from "../utils/streak-role";

import { L } from "@utils";
/**
 * Gives a member their expired streak back.
 *
 * Staff only — administrators, plus whatever roles the guild assigned with
 * `/streak-config return-role add`. It is deliberately not self-service: a streak a member can
 * restore themselves is not really a streak, it is a button.
 */
export const returnStreak: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildId = interaction.guildId!;
    const actor = interaction.member as GuildMember | null;

    if (!actor) {
        await interaction.editReply({ content: L("This command only works in a server.", "هذا الأمر يعمل داخل السيرفر فقط.") });
        return;
    }

    const settings = await StreakSettingsRepository.get(guildId);

    if (!canReturnStreaks(actor, settings?.returnRoleIds ?? [])) {
        await interaction.editReply({
            content: L("Only administrators, or a role allowed on the dashboard, can return a streak.", "إرجاع الستريك للإدارة فقط، أو لرتبة مسموحة في لوحة التحكم."),
        });
        return;
    }

    const user = interaction.options.getUser("user", true);
    const recovery = await StreakRecoveryRepository.find(user.id, guildId);

    if (!recovery) {
        await interaction.editReply({ content: L(`${user} has no streak waiting to be returned.`, `${user} ما عنده ستريك ينتظر الإرجاع.`) });
        return;
    }

    const { returnWindowHours } = resolveStreakWindows(settings);
    const deadline = recovery.expiredAt.getTime() + returnWindowHours * 3_600_000;

    if (Date.now() > deadline) {
        await interaction.editReply({
            content: L(`The ${returnWindowHours}h window to return ${user}'s streak has passed.`, `انتهت مدة الـ ${returnWindowHours} ساعة لإرجاع ستريك ${user}.`),
        });
        return;
    }

    await StreakRepository.restore(user.id, guildId, recovery.currentStreak, recovery.bestStreak);
    await StreakRecoveryRepository.delete(user.id, guildId);

    const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
    if (member) await applyStreakRole(member, recovery.currentStreak).catch(() => null);

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(L("✅ Streak returned", "✅ تم إرجاع الستريك"))
            .setColor(COLORS.success)
            .setDescription(L(`${user} is back to **${recovery.currentStreak}** days (best **${recovery.bestStreak}**).`, `${user} رجع إلى **${recovery.currentStreak}** يوم (أفضل رقم **${recovery.bestStreak}**).`))],
    });
};
