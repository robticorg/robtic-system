import { COMBO_CONFIG } from "@core/config";

interface RecentAuthorMessage {
    content: string;
    timestamp: number;
}

// In-memory, TTL-pruned (see pruneStaleSpamGuardEntries) — matches combo-conversation-detector.ts's channel buffers.
const recentByAuthor = new Map<string, RecentAuthorMessage[]>();

function key(guildId: string, authorId: string): string {
    return `${guildId}:${authorId}`;
}

export function pruneStaleSpamGuardEntries(now: number = Date.now()): void {
    for (const [k, entries] of recentByAuthor) {
        const fresh = entries.filter(e => now - e.timestamp <= COMBO_CONFIG.spamRepeatWindowMs);
        if (fresh.length === 0) recentByAuthor.delete(k);
        else recentByAuthor.set(k, fresh);
    }
}

export type ComboMessageQuality = "ignored" | "spammy" | "normal";

/** "ignored" = 3+ repeats, doesn't touch combo state at all. "spammy" = one-word or a repeat, short expiry + dampened score. */
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
