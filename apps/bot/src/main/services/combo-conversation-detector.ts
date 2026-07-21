import type { Message } from "discord.js";
import { COMBO_CONFIG } from "@core/config";

interface RecentMessage {
    authorId: string;
    timestamp: number;
}

export interface ConversationDetection {
    partnerId: string;
    confidence: number;
}

export interface ActivePartnerInfo {
    partnerId: string;
    score: number;
}

/**
 * Per-channel ring buffers of recent message authors, used purely for in-memory alternation/recency
 * signals. Bounded in size and pruned by idle time (see pruneStaleChannelBuffers) so this never grows
 * unbounded — safe for large servers and for sharding, since a guild's channels are always owned by
 * exactly one shard/process.
 */
const channelBuffers = new Map<string, RecentMessage[]>();
const channelLastSeen = new Map<string, number>();

function pushMessage(channelId: string, entry: RecentMessage): void {
    const buffer = channelBuffers.get(channelId) ?? [];
    buffer.push(entry);
    if (buffer.length > COMBO_CONFIG.recentBufferSize) buffer.shift();
    channelBuffers.set(channelId, buffer);
    channelLastSeen.set(channelId, entry.timestamp);
}

/** Drops detection state for channels that have had no activity in a while — call periodically from the scheduler. */
export function pruneStaleChannelBuffers(now: number = Date.now()): void {
    for (const [channelId, lastSeen] of channelLastSeen) {
        if (now - lastSeen > COMBO_CONFIG.channelBufferTtlMs) {
            channelBuffers.delete(channelId);
            channelLastSeen.delete(channelId);
        }
    }
}

/**
 * Infers who a message's author is most likely conversing with, using a weighted combination of
 * signals: reply, mention, alternation/recency, and continuity with an existing active combo
 * (weighted up further by that combo's current score). Returns null when no candidate clears the
 * minimum confidence threshold, meaning the message doesn't count as a conversational interaction
 * for combo purposes.
 */
export function detectConversationPartner(
    message: Message,
    getActivePartner: (userId: string) => ActivePartnerInfo | null,
): ConversationDetection | null {
    const channelId = message.channel.id;
    const authorId = message.author.id;
    const now = message.createdTimestamp || Date.now();
    const buffer = channelBuffers.get(channelId) ?? [];

    const candidates = new Map<string, number>();
    const addSignal = (id: string | null | undefined, weight: number): void => {
        if (!id || id === authorId || weight <= 0) return;
        candidates.set(id, (candidates.get(id) ?? 0) + weight);
    };

    // Reply — the strongest, most explicit signal.
    addSignal(message.mentions.repliedUser?.id ?? null, 0.6);

    // Direct mention.
    for (const user of message.mentions.users.values()) {
        addSignal(user.id, 0.3);
    }

    // Alternation / recency — whoever last spoke in this channel, weighted by how recently.
    for (let i = buffer.length - 1; i >= 0; i--) {
        const candidate = buffer[i];
        if (candidate.authorId === authorId) continue;
        const elapsed = now - candidate.timestamp;
        if (elapsed > COMBO_CONFIG.detectionWindowMs) break;
        // Decay tuned for realistic typing/reply pacing (people often take 30-90s to respond),
        // not just near-instant replies — a stricter curve here was causing normally-paced
        // conversations to silently stop scoring after the first quick exchange.
        const recencyWeight = elapsed <= 20_000 ? 0.45 : elapsed <= 60_000 ? 0.35 : elapsed <= 120_000 ? 0.22 : 0;
        addSignal(candidate.authorId, recencyWeight);
        break;
    }

    // Previous conversation partner + existing conversation score — a solid baseline bias toward
    // the partner the author is already in an active combo with (an ongoing conversation should
    // reliably keep scoring on its own, not depend on also landing a fast reply every time), scaled
    // up further the stronger (higher-scoring) that existing conversation already is.
    const activePartner = getActivePartner(authorId);
    if (activePartner) {
        const scoreWeight = Math.min(activePartner.score / 30, 1) * 0.2;
        addSignal(activePartner.partnerId, 0.25 + scoreWeight);
    }

    pushMessage(channelId, { authorId, timestamp: now });

    let bestId: string | null = null;
    let bestScore = 0;
    for (const [id, score] of candidates) {
        if (score > bestScore) {
            bestId = id;
            bestScore = score;
        }
    }

    if (!bestId || bestScore < COMBO_CONFIG.detectionConfidenceThreshold) return null;
    return { partnerId: bestId, confidence: Math.min(1, bestScore) };
}
