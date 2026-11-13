import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS, STREAK_CONFIG } from "@constants";
import { L, formatDuration } from "@utils";
import { StreakSettingsRepository } from "@database/repositories";
import { resolveStreakWindows } from "@core/streak";

/** Views the guild's streak settings, updating min-length first when that option was supplied. */
export const settings: FeatureSubcommandHandler = async (interaction, _client) => {
    const guildId = interaction.guildId!;
    const minLength = interaction.options.getInteger("min-length");

    let config = await StreakSettingsRepository.getOrCreate(guildId);
    if (minLength !== null) {
        config = await StreakSettingsRepository.setMinMessageLength(guildId, minLength);
    }

    const windows = resolveStreakWindows(config);
    const day = 24 * 60 * 60 * 1000;

    const embed = new EmbedBuilder()
        .setTitle(L("Streak settings", "إعدادات الستريك"))
        .addFields(
            { name: L("Channels", "الرومات"), value: config.channels.length ? config.channels.map(id => `<#${id}>`).join(", ") : L("None", "لا يوجد") },
            { name: L("Reminders", "التذكيرات"), value: config.remindersEnabled ? L("On", "مفعّل") : L("Off", "معطّل"), inline: true },
            { name: L("Shortest message that counts", "الحد الأدنى لطول الرسالة"), value: `${config.minMessageLength}`, inline: true },
            { name: L("Claim every", "مدة الحصول على التتابع"), value: formatDuration(windows.claimDays * day), inline: true },
            { name: L("Expires after", "مدة انتهاء الصلاحية"), value: formatDuration(windows.expireDays * day), inline: true },
            { name: L("Reminder before", "التذكير قبل"), value: formatDuration(STREAK_CONFIG.reminderThresholdMs), inline: true },
            { name: L("Return window", "مدة الاسترجاع"), value: formatDuration(windows.returnWindowHours * 60 * 60 * 1000), inline: true },
            { name: L("A timeout ends the streak", "التايم أوت ينهي الستريك"), value: (config.breakOnTimeout ?? true) ? L("Yes", "نعم") : L("No", "لا"), inline: true },
            { name: L("A kick ends the streak", "الطرد ينهي الستريك"), value: config.breakOnKick ? L("Yes", "نعم") : L("No", "لا"), inline: true },
            {
                name: L("Roles that may return streaks", "رتب إرجاع الستريك"),
                value: config.returnRoleIds?.length ? config.returnRoleIds.map(id => `<@&${id}>`).join(", ") : L("Administrators only", "الإدارة فقط"),
            },
        )
        .setColor(COLORS.info)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
};
