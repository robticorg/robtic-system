import type { Message } from "discord.js";
import { COMBO_CONFIG, WHITESPACE_SPLIT_REGEX } from "@constants";
import { isAcceptableMessage } from "@utils";
import { applyComboMessage, type ComboMessageInput } from "@core/combo";
import { Logger } from "@logger";
import { QUEUES, enqueue, getComboPartner, isRedisConfigured, jobIds, newRequestId, setComboPartners } from "@queue";
import { detectConversationPartner, type ActivePartnerInfo } from "../conversation-detector";
import { getCachedPartner, cachePartners } from "./active-partner-cache";

const CTX = "main:combo";
let lastFallbackWarning = 0;

/**
 * The Gateway half of a combo message: detect who the author is talking to (that needs this
 * process's view of each channel) and measure the message. With Redis the rest — the pair's
 * score, heat, Points and records — is a `combo` job for the worker; without it, or if queueing
 * fails, the same `@core/combo` code runs here.
 */
export async function processComboMessage(message: Message): Promise<void> {
    if (!message.inGuild() || message.author.bot || message.webhookId) return;

    const guildId = message.guild.id;
    const authorId = message.author.id;
    const shared = isRedisConfigured();

    const known = await knownPartner(guildId, authorId, shared);
    const detection = detectConversationPartner(message, () => known);
    if (!detection || detection.partnerId === authorId) return;

    const content = message.content.trim();
    const input: ComboMessageInput = {
        guildId,
        authorId,
        partnerId: detection.partnerId,
        username: message.author.username,
        messageId: message.id,
        confidence: detection.confidence,
        at: new Date(message.createdTimestamp || Date.now()),
        countable: isAcceptableMessage(content, COMBO_CONFIG.minMessageLength),
        wordCount: content.split(WHITESPACE_SPLIT_REGEX).filter(Boolean).length,
        characterCount: content.length,
    };

    if (shared) {
        try {
            await enqueue(
                QUEUES.combo,
                "combo-message",
                { ...input, kind: "combo-message", at: input.at.toISOString(), requestId: newRequestId() },
                jobIds.comboMessage(guildId, message.id),
            );
            return;
        } catch (err) {
            if (Date.now() - lastFallbackWarning > 60_000) {
                lastFallbackWarning = Date.now();
                Logger.warn(`Combo queue unavailable, applying inline: ${(err as Error).message}`, CTX);
            }
        }
    }

    await applyComboMessage(input, {
        cachePartners: async (g, a, b, score) => {
            cachePartners(g, a, b, score);
            if (shared) await setComboPartners(g, a, b, score, COMBO_CONFIG.expireMs).catch(() => {});
        },
    });
}

/** The author's current partner: from Redis when the worker keeps it there, else this process's memory. */
async function knownPartner(guildId: string, authorId: string, shared: boolean): Promise<ActivePartnerInfo | null> {
    if (!shared) return getCachedPartner(guildId, authorId);
    return getComboPartner(guildId, authorId).catch(() => getCachedPartner(guildId, authorId));
}
