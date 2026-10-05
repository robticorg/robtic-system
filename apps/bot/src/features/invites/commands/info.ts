import type { FeatureSubcommandHandler } from "@typings/feature";
import { buildInfoView } from "../utils/info-view";
import { orInvitesUnavailable } from "../utils/service-errors";

/** `/info [user]` — everyone the member has invited, 10 per page. */
export const info: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") ?? interaction.user;
    await interaction.editReply({
        ...await orInvitesUnavailable(() => buildInfoView(interaction.guildId!, interaction.user.id, target, 0)),
        allowedMentions: { parse: [] },
    });
};
