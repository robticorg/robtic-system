import { TOP_DEFAULT_ACCENT } from "@constants";
import { ServerConfigRepository } from "@database/repositories";

/**
 * Each server's colour (dashboard → Leaderboards → Colour), the bar down the side of every bot message. Read
 * synchronously when a message is sent, so it comes from memory; a server not in memory yet gets the default this
 * once while its colour is fetched. Refreshed every minute.
 */
const TTL_MS = 60_000;
const COLOR = /^#[0-9a-f]{6}$/i;
const fallback = parseInt(TOP_DEFAULT_ACCENT.slice(1), 16);
const cache = new Map<string, { accent: number; at: number }>();
const loading = new Set<string>();

function refresh(guildId: string): void {
    if (loading.has(guildId)) return;
    loading.add(guildId);
    ServerConfigRepository.find(guildId)
        .then(config => {
            const value = config?.topStyle?.accent;
            cache.set(guildId, { accent: typeof value === "string" && COLOR.test(value) ? parseInt(value.slice(1), 16) : fallback, at: Date.now() });
        })
        .catch(() => undefined)
        .finally(() => loading.delete(guildId));
}

export function accentFor(guildId: string | null): number {
    if (!guildId) return fallback;
    const hit = cache.get(guildId);
    if (!hit || Date.now() - hit.at > TTL_MS) refresh(guildId);
    return hit?.accent ?? fallback;
}

/** Loads a server's colour ahead of time (called as its events come in, so the first reply already has it). */
export const warmAccent = (guildId: string | null): void => { if (guildId) accentFor(guildId); };
