import { EmbedBuilder } from "discord.js";
import { COLORS, COMMUNITY_MESSAGES } from "@constants";

import { L } from "@utils";
export function aiDecisionEmbed(
    userId: string,
    classification: string,
    confidence: number,
    fallback: boolean,
    context: string,
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(fallback ? COLORS.warning : COLORS.info)
        .setTitle(COMMUNITY_MESSAGES.aiDecisionTitle(fallback))
        .addFields(
            { name: L("User", "العضو"), value: `<@${userId}>`, inline: true },
            { name: L("Classification", "التصنيف"), value: classification, inline: true },
            { name: L("Confidence", "الثقة"), value: `${(confidence * 100).toFixed(0)}%`, inline: true },
            { name: L("Context", "السياق"), value: context, inline: true },
            { name: L("Mode", "الطريقة"), value: fallback ? L("Rule-based", "قواعد") : "AI", inline: true },
        )
        .setTimestamp();
}
