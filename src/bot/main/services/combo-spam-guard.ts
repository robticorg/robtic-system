import { COMBO_CONFIG } from "@core/config";

interface RecentAuthorMessage {
    content: string;
    timestamp: number;
}

/**
 * Per-(guild, author) rolling history of recent message content, used purely to detect repeated/
 * spammy sending patterns for combo scoring. In-memory + TTL-pruned (see pruneStaleSpamGuardEntries,
 * called from the combo scheduler), matching the same pattern combo-conversation-detector.ts already
 * uses for its channel buffers rather than persisting this to Mongo.
 */
const recentByAuthor = new Map<string, RecentAuthorMessage[]>();

function key(guildId: string, authorId: string): string {
    return `${guildId}:${authorId}`;
}

/** Drops authors with no recent activity — call periodically from the scheduler so this map stays bounded. */
export function pruneStaleSpamGuardEntries(now: number = Date.now()): void {
    for (const [k, entries] of recentByAuthor) {
        const fresh = entries.filter(e => now - e.timestamp <= COMBO_CONFIG.spamRepeatWindowMs);
        if (fresh.length === 0) recentByAuthor.delete(k);
        else recentByAuthor.set(k, fresh);
    }
}

export type ComboMessageQuality = "ignored" | "spammy" | "normal";

/**
 * Classifies an already length/emoji-gated message (isAcceptableMessage already passed) for combo
 * spam resistance:
 * - "ignored": the same content repeated 3+ times in a row within the window — pure spam, doesn't
 *   touch the combo's state at all (no score, no expiry refresh).
 * - "spammy": single-word messages, or a message repeating the author's immediately preceding one —
 *   still keeps the combo alive, but on the short `spamExpireMs` clock with dampened score.
 * - "normal": everything else — full score range, full `expireMs` window.
 */
export function classifyComboMessage(guildId: string, authorId: string, content: string, now: number): ComboMessageQuality {
    const k = key(guildId, authorId);
    const history = recentByAuthor.get(k) ?? [];
    const normalized = content.trim().toLowerCase();

    const recentDuplicates = history.filter(
        e => now - e.timestamp <= COMBO_CONFIG.spamRepeatWindowMs && e.content === normalized
    );

    history.push({ content: normalized, timestamp: now });
    if (history.length > COMBO_CONFIG.spamHistorySize) history.shift();
    recentByAuthor.set(k, history);

    if (recentDuplicates.length >= 2) return "ignored";

    const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount <= 1) return "spammy";
    if (recentDuplicates.length >= 1) return "spammy";

    return "normal";
}
