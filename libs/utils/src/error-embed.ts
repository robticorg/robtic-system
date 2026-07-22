import { EmbedBuilder } from "discord.js";
import { COLORS, SHARED_MESSAGES } from "@constants";

export const errorEmbed = (description: string) => {
    return new EmbedBuilder()
        .setTitle(SHARED_MESSAGES.errorEmbedTitle)
        .setDescription(`\`\`\`${description}\`\`\``)
        .setColor(COLORS.error)
        .setTimestamp()
        .setFooter({
            text: SHARED_MESSAGES.errorEmbedFooter,
        });
};
