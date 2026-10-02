import { EmbedBuilder } from "discord.js";
import { COLORS, COMMUNITY_MESSAGES } from "@constants";

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
            { name: "User", value: `<@${userId}>`, inline: true },
            { name: "💬 Message XP Lost", value: `-${loss.messageLoss}`, inline: true },
            { name: "🎙️ Voice XP Lost", value: `-${loss.voiceLoss}`, inline: true },
            { name: "Message Level", value: level(before.messageLevel, after.messageLevel), inline: true },
            { name: "Voice Level", value: level(before.voiceLevel, after.voiceLevel), inline: true },
        )
        .setTimestamp();
}
