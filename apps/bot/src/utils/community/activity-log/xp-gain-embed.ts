import { EmbedBuilder } from "discord.js";
import { COLORS, COMMUNITY_MESSAGES } from "@constants";

import { L } from "@utils";
export function xpGainEmbed(username: string, userId: string, xp: number, leveledUp: boolean, newLevel: number): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(leveledUp ? COLORS.success : COLORS.activity)
        .setTitle(leveledUp ? COMMUNITY_MESSAGES.levelUpTitle : COMMUNITY_MESSAGES.xpGainedTitle)
        .addFields(
            { name: L("User", "العضو"), value: `<@${userId}>`, inline: true },
            { name: L("XP", "الخبرة"), value: `+${xp}`, inline: true },
            { name: L("Level", "المستوى"), value: `${newLevel}`, inline: true },
        )
        .setTimestamp();

    if (leveledUp) {
        embed.setDescription(COMMUNITY_MESSAGES.levelUpDescription(username, newLevel));
    }

    return embed;
}
