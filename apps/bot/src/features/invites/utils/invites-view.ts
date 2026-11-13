import { EmbedBuilder, type User } from "discord.js";
import { COLORS } from "@constants";
import { invitesBackend } from "../functions/invites-backend";
import { formatBonusPercent, plural } from "./invite-format";

import { L } from "@utils";
/** The `/invites` card — also what a bare `invites @user` in a ticket channel replies with. */
export async function buildInvitesEmbed(guildId: string, guildName: string, viewerId: string, target: User, requestId?: string): Promise<EmbedBuilder> {
    const self = target.id === viewerId;
    const stats = await invitesBackend.stats(guildId, target.id, requestId);

    return new EmbedBuilder()
        .setColor(COLORS.default)
        .setThumbnail(target.displayAvatarURL({ size: 256 }))
        .setDescription([
            self
                ? L(`Your invites on **${guildName}**`, `دعواتك في **${guildName}**`)
                : L(`**${target.username}**'s invites on **${guildName}**`, `دعوات **${target.username}** في **${guildName}**`),
            "",
            L(`**${stats.joins}** Joins`, `**${stats.joins}** دخول`),
            L(`**${stats.leaves}** Leaves`, `**${stats.leaves}** خروج`),
            L(`**${stats.fakes}** Fake`, `**${stats.fakes}** وهمي`),
            L(`**${formatBonusPercent(stats.bonusBp)}** Bonus`, `**${formatBonusPercent(stats.bonusBp)}** زيادة`),
            L(`**${plural(stats.recentJoins, "invite")}** this week`, `**${plural(stats.recentJoins, "invite")}** هذا الأسبوع`),
        ].join("\n"))
        .setFooter({
            text: self
                ? L(`You have ${plural(stats.total, "invite")} in total`, `عندك ${plural(stats.total, "invite")} بالمجموع`)
                : L(`${target.username} has ${plural(stats.total, "invite")} in total`, `${target.username} عنده ${plural(stats.total, "invite")} بالمجموع`),
        });
}
