import type { FeatureSubcommandHandler } from "@typings/feature";
import { buildInvitesEmbed } from "../utils/invites-view";

/** `/invites [user]` — joins, leaves, fakes, the live reward bonus and this week's joins. */
export const invites: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") ?? interaction.user;
    const embed = await buildInvitesEmbed(interaction.guildId!, interaction.guild?.name ?? "this", interaction.user.id, target);

    await interaction.editReply({ embeds: [embed] });
};
