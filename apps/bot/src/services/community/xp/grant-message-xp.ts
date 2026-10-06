import type { Message } from "discord.js";
import { XP_CONFIG } from "@constants";
import { Logger } from "@logger";
import { QUEUES, claimCooldown, enqueue, isRedisConfigured, jobIds, newRequestId, releaseCooldown } from "@queue";
import { grantXP, skippedByAi } from "./grant-xp";
import { randomXP } from "./random-xp";
import type { XpGainResult } from "./apply-xp-gain";

const CTX = "community:xp";
let lastFallbackWarning = 0;

/**
 * Chat XP for a message that passed the channel and role checks.
 *
 * With Redis: the Gateway keeps the cheap decisions (meaningful?, cooldown — claimed atomically in
 * Redis), rolls the amount, and queues an `xp` job; the worker writes MongoDB and sends level-ups
 * back through the outbox. Returns `"queued"`.
 *
 * Without Redis, or if Redis fails, it grants inline exactly as before (MongoDB cooldown included).
 */
export async function grantMessageXp(message: Message<true>, content: string): Promise<"queued" | XpGainResult | null> {
    const { guild, author } = message;
    if (!isRedisConfigured()) return grantXP(author.id, guild.id, author.username, guild, content);

    if (skippedByAi(content, author.username)) return null;

    const cooldownKey = `xp:cd:${guild.id}:${author.id}`;
    let claimed: boolean;
    try {
        claimed = await claimCooldown(cooldownKey, XP_CONFIG.cooldownMs);
    } catch (err) {
        return fallback(message, content, err);
    }
    if (!claimed) return null;

    try {
        await enqueue(
            QUEUES.xp,
            "message-xp",
            {
                kind: "message-xp",
                guildId: guild.id,
                memberId: author.id,
                username: author.username,
                messageId: message.id,
                xp: randomXP(),
                at: message.createdAt.toISOString(),
                requestId: newRequestId(),
            },
            jobIds.messageXp(guild.id, message.id),
        );
        return "queued";
    } catch (err) {
        // Nothing was queued: give the window back so the inline grant below can use it.
        await releaseCooldown(cooldownKey).catch(() => {});
        return fallback(message, content, err);
    }
}

function fallback(message: Message<true>, content: string, err: unknown): Promise<XpGainResult | null> {
    if (Date.now() - lastFallbackWarning > 60_000) {
        lastFallbackWarning = Date.now();
        Logger.warn(`XP queue unavailable, granting inline: ${(err as Error).message}`, CTX);
    }
    return grantXP(message.author.id, message.guild.id, message.author.username, message.guild, content);
}
