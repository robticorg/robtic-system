import { EmbedBuilder } from "discord.js";
import { COLORS, COMMUNITY_MESSAGES } from "@constants";

import { L } from "@utils";
type Levels = { messageLevel: number; voiceLevel: number };

export function decayEmbed(
    userId: string,
    loss: { messageLoss: number; voiceLoss: number },
    levelDown: boolean,
    before: Levels,
    after: Levels,
): EmbedBuilder {
    const level = (from: number, to: number) => (from !== to ? `${from} → ${to}` : `${to}`);

    return new EmbedBuilder()
        .setColor(levelDown ? COLORS.error : COLORS.warning)
        .setTitle(levelDown ? COMMUNITY_MESSAGES.levelDownDecayTitle : COMMUNITY_MESSAGES.xpDecayTitle)
        .addFields(
            { name: L("User", "العضو"), value: `<@${userId}>`, inline: true },
            { name: L("💬 Message XP lost", "💬 خبرة رسائل مفقودة"), value: `-${loss.messageLoss}`, inline: true },
            { name: L("🎙️ Voice XP lost", "🎙️ خبرة صوت مفقودة"), value: `-${loss.voiceLoss}`, inline: true },
            { name: L("Message level", "مستوى الرسائل"), value: level(before.messageLevel, after.messageLevel), inline: true },
            { name: L("Voice level", "مستوى الصوت"), value: level(before.voiceLevel, after.voiceLevel), inline: true },
        )
        .setTimestamp();
}
