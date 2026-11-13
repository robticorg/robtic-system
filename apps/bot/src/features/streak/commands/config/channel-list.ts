import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { StreakSettingsRepository } from "@database/repositories";

import { L } from "@utils";
export const channelList: FeatureSubcommandHandler = async (interaction, _client) => {
    const settings = await StreakSettingsRepository.getOrCreate(interaction.guildId!);
    const list = settings.channels.length ? settings.channels.map(id => `<#${id}>`).join(", ") : L("None", "لا يوجد");

    await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle(L("Streak channels", "رومات الستريك")).setDescription(list).setColor(COLORS.info)],
    });
};
