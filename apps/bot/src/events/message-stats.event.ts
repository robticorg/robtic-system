import { Events, type Message } from "discord.js";
import { ActivityRepository, PeriodicStatRepository } from "@database/repositories";
import { isAcceptableMessage } from "@utils";
import { MESSAGE_STATS_CONFIG } from "@constants";
import { handleError, BotError } from "@core/handlers";
import { awardMessagePoint } from "@core/points";
import { messageBufferField } from "@core/activity";
import { awardMessageMilestone } from "@core/staff-api";
import { bufferMessage, isRedisConfigured } from "@queue";
import { Logger } from "@logger";
import { isExcludedChannel } from "@bot/services/community/xp";

/**
 * Counts a real message. With Redis, it's one HINCRBY — the worker flushes the counts to MongoDB
 * (real-message total, period stats, points, staff milestones) every few seconds. Without Redis,
 * or if Redis fails, it falls back to writing MongoDB directly, so no message goes uncounted.
 */
async function countInline(message: Message<true>): Promise<void> {
    const activity = await ActivityRepository.incrementRealMessageCount(message.author.id, message.guild.id, message.author.username);
    if (activity) void awardMessageMilestone(message.guild.id, message.author.id, activity.realMessageCount);
    await PeriodicStatRepository.incrementAllPeriods(message.guild.id, "messages", message.author.id, 1);
    await awardMessagePoint(message.guild.id, message.author.id, message.author.username);
}

let lastBufferWarning = 0;

export default {
    name: Events.MessageCreate,

    async execute(message: Message) {
        if (message.author.bot || message.webhookId) return;
        if (!message.inGuild()) return;

        const content = message.content.trim();
        if (!isAcceptableMessage(content, MESSAGE_STATS_CONFIG.minMessageLength)) return;
        if (await isExcludedChannel(message.guild.id, message.channel.id)) return;

        try {
            if (isRedisConfigured()) {
                const at = message.createdAt;
                try {
                    await bufferMessage(messageBufferField(at, message.guild.id, message.author.id), message.guild.id, message.author.id, message.author.username, at);
                    return;
                } catch (err) {
                    // Throttled: a Redis outage would otherwise log once per message.
                    if (Date.now() - lastBufferWarning > 60_000) {
                        lastBufferWarning = Date.now();
                        Logger.warn(`Message buffer unavailable, counting inline: ${(err as Error).message}`, "message-stats");
                    }
                }
            }
            await countInline(message);
        } catch (err) {
            handleError(new BotError(`Failed to process message stats: ${err}`, "EVENT"), "main/message-stats");
        }
    },
};
