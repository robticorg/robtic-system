import { type ButtonInteraction } from "discord.js";
import type { ComponentHandler } from "@core/config";
import { getLeaderboard, buildLeaderboardEmbed, type LeaderboardMode } from "../services/streak-service";
import { buildStreakTopButtons } from "../commands/streak-top";

export const streakTopToggleHandler: ComponentHandler<ButtonInteraction> = {
    customId: /^streak-top-(current|best)$/,

    async run(interaction: ButtonInteraction) {
        const mode = interaction.customId.split("-")[2] as LeaderboardMode;
        const guildId = interaction.guildId!;

        const records = await getLeaderboard(guildId, mode);
        const embed = buildLeaderboardEmbed(interaction.guild!.name, mode, records);

        await interaction.update({ embeds: [embed], components: [buildStreakTopButtons(mode)] });
    },
};
