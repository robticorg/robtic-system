import { EmbedBuilder, type User } from "discord.js";
import { COLORS } from "@constants";
import { invitesBackend } from "../functions/invites-backend";
import { formatBonusPercent, plural } from "./invite-format";

/** The `/invites` card — also what a bare `invites @user` in a ticket channel replies with. */
export async function buildInvitesEmbed(guildId: string, guildName: string, viewerId: string, target: User, requestId?: string): Promise<EmbedBuilder> {
    const self = target.id === viewerId;
    const stats = await invitesBackend.stats(guildId, target.id, requestId);

    return new EmbedBuilder()
        .setColor(COLORS.default)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setDescription([
            self
                ? `This is your invites count on **${guildName}** server`
                : `This is **${target.username}**'s invites count on **${guildName}** server`,
            "",
            `**${stats.joins}** Joins`,
            `**${stats.leaves}** Leaves`,
            `**${stats.fakes}** Fake`,
            `**${formatBonusPercent(stats.bonusBp)}** Bonus`,
            `**${plural(stats.recentJoins, "invite")}** this week`,
        ].join("\n"))
        .setFooter({
            text: self
                ? `You have ${plural(stats.total, "invite")} in total`
                : `${target.username} has ${plural(stats.total, "invite")} in total`,
        });
}
