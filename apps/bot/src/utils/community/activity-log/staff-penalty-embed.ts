import { EmbedBuilder } from "discord.js";
import { COLORS, COMMUNITY_MESSAGES } from "@constants";

import { L } from "@utils";
export function staffPenaltyEmbed(staffId: string, points: number, reason: string): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(COLORS.error)
        .setTitle(COMMUNITY_MESSAGES.staffPenaltyTitle)
        .addFields(
            { name: L("Staff", "الإداري"), value: `<@${staffId}>`, inline: true },
            { name: L("Points", "النقاط"), value: `${points}`, inline: true },
            { name: L("Reason", "السبب"), value: reason },
        )
        .setTimestamp();
}
