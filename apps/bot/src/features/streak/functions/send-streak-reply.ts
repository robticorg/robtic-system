import { EmbedBuilder, type Message } from "discord.js";
import type { IStreak, IStreakSettings } from "@database/models";
import { StreakRewardRepository } from "@database/repositories";
import { STREAK_MESSAGES } from "@constants";
import { Logger } from "@logger";

const CTX = "main:streak";

/**
 * What a claim shows, exactly as the Streaks plugin's Robtic Rules say (streaks.rrl, "Claim the daily streak"):
 * on a reward day the milestone embed, in the milestone channel or where it was earned; any other day a 🔥 on the
 * message. Nothing is sent by DM.
 */
export async function sendStreakReply(message: Message, streak: IStreak, settings: IStreakSettings): Promise<void> {
    const days = new Set((await StreakRewardRepository.list(settings.guildId)).map(r => r.threshold));
    if (!days.has(streak.currentStreak)) {
        await message.react("🔥").catch(() => null);
        return;
    }

    const embed = new EmbedBuilder().setDescription(STREAK_MESSAGES.reached(message.author.id, streak.currentStreak)).setColor(0xf97316);
    const target = settings.announceChannelId
        ? message.guild?.channels.cache.get(settings.announceChannelId) ?? await message.guild?.channels.fetch(settings.announceChannelId).catch(() => null)
        : null;
    const channel = target?.isSendable() ? target : message.channel.isSendable() ? message.channel : null;
    await channel?.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(err => Logger.warn(`Could not post a streak milestone: ${err}`, CTX));
}
