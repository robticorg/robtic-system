import { getRedis } from "./message-buffer";

/**
 * "Who is each member talking to right now" for the combo detector, shared by the Gateway (reads
 * it to detect partners) and the worker (writes it after applying a message). Entries expire with
 * the combo window, exactly like the old in-memory cache.
 */

const key = (guildId: string, userId: string) => `combo:partner:${guildId}:${userId}`;

export async function setComboPartners(guildId: string, a: string, b: string, score: number, ttlMs: number): Promise<void> {
    await getRedis()
        .multi()
        .set(key(guildId, a), JSON.stringify({ partnerId: b, score }), "PX", ttlMs)
        .set(key(guildId, b), JSON.stringify({ partnerId: a, score }), "PX", ttlMs)
        .exec();
}

export async function getComboPartner(guildId: string, userId: string): Promise<{ partnerId: string; score: number } | null> {
    const raw = await getRedis().get(key(guildId, userId));
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as { partnerId?: unknown; score?: unknown };
        return typeof parsed.partnerId === "string" && typeof parsed.score === "number" ? { partnerId: parsed.partnerId, score: parsed.score } : null;
    } catch {
        return null;
    }
}
