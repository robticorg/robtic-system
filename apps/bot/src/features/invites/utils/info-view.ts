import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type User } from "discord.js";
import { COLORS, INVITES_CONFIG } from "@constants";
import { InviteJoinRepository } from "@database/repositories";
import { clampPage, pageCount } from "./invite-format";

const PAGE_SIZE = INVITES_CONFIG.infoPageSize;

/**
 * The `/info` page button id. It carries everything a redraw needs — who opened the panel, whose
 * invites it shows, and which page to go to — because a button click arrives with no memory of the
 * message it came from. The trailing direction only keeps the two ids distinct.
 */
export const INFO_PAGE_ID = /^invites:info:\d+:\d+:\d+:(prev|next)$/;

function pageButton(invokerId: string, targetId: string, page: number, direction: "prev" | "next", disabled: boolean): ButtonBuilder {
    return new ButtonBuilder()
        .setCustomId(`invites:info:${invokerId}:${targetId}:${Math.max(0, page)}:${direction}`)
        .setLabel(direction === "prev" ? "Prev" : "Next")
        .setEmoji(direction === "prev" ? "◀️" : "▶️")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled);
}

/**
 * One page of everyone `target` has invited, newest first: the member, how long ago they joined,
 * and whether they are still here. Status is the recorded one — a member who left while the bot
 * was offline still shows as Available until their next join or leave is seen.
 */
export async function buildInfoView(guildId: string, invokerId: string, target: User, requestedPage: number) {
    const joins = await InviteJoinRepository.countByInviter(guildId, target.id);
    const page = clampPage(requestedPage, joins, PAGE_SIZE);
    const pages = pageCount(joins, PAGE_SIZE);
    const rows = await InviteJoinRepository.listByInviter(guildId, target.id, page * PAGE_SIZE, PAGE_SIZE);

    const lines = rows.map((row, i) => {
        const since = `<t:${Math.floor(row.joinedAt.getTime() / 1000)}:R>`;
        const status = row.leftAt ? "Left Server" : "Available";
        return `**${page * PAGE_SIZE + i + 1}.** <@${row.inviteeId}> · ${since} (${status})`;
    });

    const embed = new EmbedBuilder()
        .setColor(COLORS.default)
        .setAuthor({ name: `${target.username}'s invites`, iconURL: target.displayAvatarURL({ size: 64 }) })
        .setDescription(lines.length ? lines.join("\n") : `**${target.username}** hasn't invited anyone yet.`)
        .setFooter({ text: `Page ${page + 1}/${pages} · ${joins} join${joins === 1 ? "" : "s"}` });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        pageButton(invokerId, target.id, page - 1, "prev", page === 0),
        pageButton(invokerId, target.id, page + 1, "next", page >= pages - 1),
    );

    return { embeds: [embed], components: [row] };
}
