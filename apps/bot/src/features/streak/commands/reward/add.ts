import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { StreakRewardRepository } from "@database/repositories";

import { L } from "@utils";
export const add: FeatureSubcommandHandler = async (interaction, _client) => {
    const guildId = interaction.guildId!;
    const number = interaction.options.getInteger("number", true);
    const offer = interaction.options.getString("offer", true);

    await StreakRewardRepository.add(guildId, number, offer, interaction.user.id);

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setColor(COLORS.success)
            .setDescription(L(`✅ A member who reaches a **${number}**-day streak gets: ${offer}`, `✅ العضو اللي يوصل **${number}** يوم ستريك بيحصل على: ${offer}`))],
    });
};
