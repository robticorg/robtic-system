import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { StreakRewardRepository } from "@database/repositories";

import { L } from "@utils";
export const list: FeatureSubcommandHandler = async (interaction, _client) => {
    const rewards = await StreakRewardRepository.list(interaction.guildId!);

    if (!rewards.length) {
        await interaction.editReply({
            embeds: [new EmbedBuilder().setColor(COLORS.info).setDescription(L("No streak rewards yet.", "ما في مكافآت ستريك لين الحين."))],
        });
        return;
    }

    const lines = rewards.map(r => L(`**${r.threshold}** days — ${r.offer}`, `**${r.threshold}** يوم — ${r.offer}`)).join("\n");
    await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle(L("🎁 Streak rewards", "🎁 مكافآت الستريك")).setDescription(lines).setColor(COLORS.info)],
    });
};
