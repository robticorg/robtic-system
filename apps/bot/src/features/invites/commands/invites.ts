import { EmbedBuilder } from "discord.js";
import type { FeatureSubcommandHandler } from "@typings/feature";
import { COLORS } from "@constants";
import { getInviteStats } from "../functions/get-invite-stats";
import { formatBonusPercent, plural } from "../utils/invite-format";

/** `/invites [user]` — joins, leaves, the live reward bonus and this week's joins. */
export const invites: FeatureSubcommandHandler = async (interaction, _client) => {
    await interaction.deferReply();

    const target = interaction.options.getUser("user") ?? interaction.user;
    const self = target.id === interaction.user.id;
    const stats = await getInviteStats(interaction.guildId!, target.id);
    const guildName = interaction.guild?.name ?? "this";

    const embed = new EmbedBuilder()
        .setColor(COLORS.default)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setDescription([
            self
                ? `This is your invites count on **${guildName}** server`
                : `This is **${target.username}**'s invites count on **${guildName}** server`,
            "",
            `**${stats.joins}** Joins`,
            `**${stats.leaves}** Leaves`,
            `**${formatBonusPercent(stats.bonusBp)}** Bonus`,
            `**${plural(stats.recentJoins, "invite")}** this week`,
        ].join("\n"))
        .setFooter({
            text: self
                ? `You have ${plural(stats.total, "invite")} in total`
                : `${target.username} has ${plural(stats.total, "invite")} in total`,
        });

    await interaction.editReply({ embeds: [embed] });
};
