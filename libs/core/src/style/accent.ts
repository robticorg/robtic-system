import { TOP_DEFAULT_ACCENT } from "@constants";
import { ServerConfigRepository } from "@database/repositories";
import { setGuildEmojiLookup } from "@config/emojis";

/**
 * Each server's colour (dashboard → Leaderboards → Colour), the bar down the side of every bot message, and its own
 * emojis (dashboard → Emojis). Read synchronously when a message is built, so they come from memory; a server not in
 * memory yet gets the defaults this once while its settings are fetched. Refreshed every minute.
 */
const TTL_MS = 60_000;
const COLOR = /^#[0-9a-f]{6}$/i;
const fallback = parseInt(TOP_DEFAULT_ACCENT.slice(1), 16);
const EMOJI = /^(<a?:[A-Za-z0-9_]{2,32}:\d{15,22}>|[^\s<>]{1,16})$/u;
const cache = new Map<string, { accent: number; emojis: Record<string, string>; at: number }>();
const loading = new Set<string>();

function refresh(guildId: string): void {
    if (loading.has(guildId)) return;
    loading.add(guildId);
    ServerConfigRepository.find(guildId)
        .then(config => {
            const value = config?.topStyle?.accent;
            const emojis = Object.fromEntries(Object.entries(config?.emojis ?? {}).filter(([, v]) => typeof v === "string" && EMOJI.test(v)));
            cache.set(guildId, { accent: typeof value === "string" && COLOR.test(value) ? parseInt(value.slice(1), 16) : fallback, emojis, at: Date.now() });
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

/** This server's own emoji for a slot, if it set one. */
export function guildEmojiFor(guildId: string, key: string): string | undefined {
    const hit = cache.get(guildId);
    if (!hit || Date.now() - hit.at > TTL_MS) refresh(guildId);
    return hit?.emojis[key] || undefined;
}
setGuildEmojiLookup(guildEmojiFor);

/** Loads a server's colour ahead of time (called as its events come in, so the first reply already has it). */
export const warmAccent = (guildId: string | null): void => { if (guildId) accentFor(guildId); };
