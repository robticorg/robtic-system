import { EmbedBuilder } from "discord.js";
import { COLORS, COMMUNITY_MESSAGES } from "@constants";

import { L } from "@utils";
export function supportSessionEmbed(
    action: "created" | "claimed" | "resolved" | "auto-closed" | "reassigned",
    userId: string,
    staffId?: string,
    details?: string,
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(action === "resolved" ? COLORS.success : action === "auto-closed" || action === "reassigned" ? COLORS.warning : COLORS.info)
        .setTitle(COMMUNITY_MESSAGES.sessionTitles[action])
        .addFields({ name: L("User", "العضو"), value: `<@${userId}>`, inline: true })
        .setTimestamp();

    if (staffId) {
        embed.addFields({ name: L("Staff", "الإداري"), value: `<@${staffId}>`, inline: true });
    }
    if (details) {
        embed.addFields({ name: L("Details", "التفاصيل"), value: details });
    }

    return embed;
}
