import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { StreakRewardRepository } from "@database/repositories";

import { L } from "@utils";
export const remove: FeatureSubcommandHandler = async (interaction, _client) => {
    const guildId = interaction.guildId!;
    const number = interaction.options.getInteger("number", true);
    const removed = await StreakRewardRepository.remove(guildId, number);

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setColor(removed ? COLORS.success : COLORS.error)
            .setDescription(removed ? L(`✅ Removed the **${number}**-day reward.`, `✅ تم حذف مكافأة **${number}** يوم.`) : L(`❌ There's no reward at **${number}** days.`, `❌ ما في مكافأة عند **${number}** يوم.`))],
    });
};
