import type { FeatureSubcommandHandler } from "@typings/feature";
import { POINT_MESSAGES } from "@constants";
import { getPointSummary } from "@core/points";
import { resolveTarget } from "../utils/resolve-target";

export const balance: FeatureSubcommandHandler = async (interaction, _client) => {
    const target = await resolveTarget(interaction);
    const summary = await getPointSummary(interaction.guildId!, target.user.id);

    await interaction.editReply({
        content: target.isSelf
            ? POINT_MESSAGES.ownBalance(summary.points, summary.rank)
            : POINT_MESSAGES.otherBalance(target.displayName, summary.points, summary.rank),
    });
};
