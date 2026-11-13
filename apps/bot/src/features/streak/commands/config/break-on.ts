import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { StreakSettingsRepository } from "@database/repositories";

import { L } from "@utils";
/** Chooses which punishments end a streak. Omitted options are left alone. */
export const breakOn: FeatureSubcommandHandler = async (interaction, _client) => {
    const guildId = interaction.guildId!;
    const settings = await StreakSettingsRepository.get(guildId);

    const timeoutInput = interaction.options.getBoolean("timeout");
    const kickInput = interaction.options.getBoolean("kick");

    const breakOnTimeout = timeoutInput === null ? (settings?.breakOnTimeout ?? true) : timeoutInput;
    const breakOnKick = kickInput === null ? (settings?.breakOnKick ?? false) : kickInput;

    await StreakSettingsRepository.setBreakTriggers(guildId, breakOnTimeout, breakOnKick);

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setTitle(L("Streak break rules updated", "تم تحديث قواعد إنهاء الستريك"))
            .setColor(COLORS.success)
            .setDescription(
                L(`**Timeout:** ${breakOnTimeout ? "ends the streak" : "no effect"}\n`, `**التايم أوت:** ${breakOnTimeout ? "ينهي الستريك" : "بدون تأثير"}\n`) +
                L(`**Kick:** ${breakOnKick ? "ends the streak" : "no effect"}`, `**الطرد:** ${breakOnKick ? "ينهي الستريك" : "بدون تأثير"}`)
            )
            .setFooter({ text: L("/mute, /jail and warn auto-mutes all apply a timeout, so they follow the timeout setting.", "/mute و /jail والميوت التلقائي من التحذير كلها تايم أوت، فتتبع إعداد التايم أوت.") })],
    });
};
