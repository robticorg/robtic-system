import { EmbedBuilder } from "discord.js";
import { COLORS, COMMUNITY_MESSAGES } from "@constants";

import { L } from "@utils";
export function supportPointsEmbed(staffId: string, points: number, responseMs: number): EmbedBuilder {
    const seconds = Math.round(responseMs / 1000);
    return new EmbedBuilder()
        .setColor(points >= 0 ? COLORS.success : COLORS.error)
        .setTitle(points >= 0 ? COMMUNITY_MESSAGES.supportPointsTitle : COMMUNITY_MESSAGES.supportPenaltyTitle)
        .addFields(
            { name: L("Staff", "الإداري"), value: `<@${staffId}>`, inline: true },
            { name: L("Points", "النقاط"), value: `${points > 0 ? "+" : ""}${points}`, inline: true },
            { name: L("Response time", "وقت الرد"), value: `${seconds}s`, inline: true },
        )
        .setTimestamp();
}
