import type { FeatureSubcommandHandler } from "@typings/feature";
import { StreakSettingsRepository } from "@database/repositories";

import { L } from "@utils";
export const channelRemove: FeatureSubcommandHandler = async (interaction, _client) => {
    const channel = interaction.options.getChannel("channel", true);
    await StreakSettingsRepository.removeChannel(interaction.guildId!, channel.id);
    await interaction.editReply({ content: L(`Removed <#${channel.id}> from the streak channels.`, `تم حذف <#${channel.id}> من رومات الستريك.`) });
};
