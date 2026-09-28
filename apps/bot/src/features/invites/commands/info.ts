import type { FeatureSubcommandHandler } from "@typings/feature";
import { buildInfoView } from "../utils/info-view";

/** `/info [user]` — everyone the member has invited, 10 per page. */
export const info: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") ?? interaction.user;
    await interaction.editReply({
        ...await buildInfoView(interaction.guildId!, interaction.user.id, target, 0),
        allowedMentions: { parse: [] },
    });
};
