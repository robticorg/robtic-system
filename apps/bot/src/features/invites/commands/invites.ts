import type { FeatureSubcommandHandler } from "@typings/feature";
import { buildInvitesEmbed } from "../utils/invites-view";
import { orInvitesUnavailable } from "../utils/service-errors";

/** `/invites [user]` — joins, leaves, fakes, the live reward bonus and this week's joins. */
export const invites: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") ?? interaction.user;
    const reply = await orInvitesUnavailable(async () => ({
        embeds: [await buildInvitesEmbed(interaction.guildId!, interaction.guild?.name ?? "this", interaction.user.id, target)],
    }));

    await interaction.editReply(reply);
};
