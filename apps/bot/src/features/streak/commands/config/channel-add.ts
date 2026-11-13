import type { FeatureSubcommandHandler } from "@typings/feature";
import { StreakSettingsRepository } from "@database/repositories";

import { L } from "@utils";
export const channelAdd: FeatureSubcommandHandler = async (interaction, _client) => {
    const channel = interaction.options.getChannel("channel", true);
    await StreakSettingsRepository.addChannel(interaction.guildId!, channel.id);
    await interaction.editReply({ content: L(`Added <#${channel.id}> as a streak channel.`, `تمت إضافة <#${channel.id}> كروم للستريك.`) });
};
