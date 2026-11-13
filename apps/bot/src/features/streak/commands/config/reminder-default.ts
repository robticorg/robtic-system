import type { FeatureSubcommandHandler } from "@typings/feature";
import { StreakSettingsRepository } from "@database/repositories";

import { L } from "@utils";
export const reminderDefault: FeatureSubcommandHandler = async (interaction, _client) => {
    const enabled = interaction.options.getBoolean("enabled", true);
    await StreakSettingsRepository.setRemindersEnabled(interaction.guildId!, enabled);
    await interaction.editReply({ content: L(`Streak-ending reminders are now **${enabled ? "on" : "off"}**.`, `تذكيرات انتهاء الستريك صارت **${enabled ? "مفعّلة" : "مقفلة"}**.`) });
};
