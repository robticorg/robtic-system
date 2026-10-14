import {
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    TextDisplayBuilder,
} from "discord.js";
import { EMOJI, LINE_NAME } from "./entry-post";
import type { LeaderboardRow } from "./stats";

export const LEADERBOARD_REFRESH_MS = 60 * 60_000;

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * The leaderboard (components v2): top 10 by current votes, each with their current invites, and
 * when it was last refreshed. Refreshed every hour, and right away on `!start` / `!end`.
 */
export function buildLeaderboard(rows: LeaderboardRow[], refreshedAt: Date, hasLine: boolean): ContainerBuilder {
    const lines = rows.length
        ? rows.map((r, i) => [
            `${MEDALS[i] ?? `**${i + 1}.**`} **#${r.number}** <@${r.userId}>`,
            `${EMOJI.minidot} Votes: **${r.votes}** ${EMOJI.info} Invites: **${r.invites}**`,
        ].join("\n"))
        : ["No participants yet."];

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent("## 🏆 Leaderboard — Top 10"))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.join("\n\n")))
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Last refresh: <t:${Math.floor(refreshedAt.getTime() / 1000)}:R> · refreshes every hour`));

    if (hasLine) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(`attachment://${LINE_NAME}`)));
    return container;
}
