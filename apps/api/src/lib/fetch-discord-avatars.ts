import { Logger } from "@logger";
import { botToken } from "./discord-api";

const AVATAR_CACHE_TTL_MS = 30 * 60 * 1000;
const CTX = "api:avatars";

interface CachedAvatar {
    url: string | null;
    username: string | null;
    expiresAt: number;
}

const avatarCache = new Map<string, CachedAvatar>();

function avatarUrlFor(id: string, avatar: string | null): string | null {
    if (!avatar) return null;
    const ext = avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`;
}

/**
 * Best-effort avatar/display-name enrichment via the bot token, cached for half an hour.
 * Degrades to nulls when no token is configured — the UI falls back to a generated placeholder,
 * so a missing token costs polish, never correctness.
 */
export async function fetchDiscordProfiles(ids: string[]): Promise<Map<string, { url: string | null; username: string | null }>> {
    const result = new Map<string, { url: string | null; username: string | null }>();
    const now = Date.now();
    const missing: string[] = [];

    for (const id of new Set(ids)) {
        const cached = avatarCache.get(id);
        if (cached && cached.expiresAt > now) {
            result.set(id, { url: cached.url, username: cached.username });
        } else {
            missing.push(id);
        }
    }

    const token = botToken();
    if (!token || missing.length === 0) {
        for (const id of missing) result.set(id, { url: null, username: null });
        return result;
    }

    for (const id of missing) {
        const response = await fetch(`https://discord.com/api/users/${id}`, {
            headers: { Authorization: `Bot ${token}` },
        }).catch(() => null);

        if (!response?.ok) {
            if (response && response.status !== 404) {
                Logger.debug(`Avatar lookup for ${id} failed with ${response.status}`, CTX);
            }
            avatarCache.set(id, { url: null, username: null, expiresAt: now + AVATAR_CACHE_TTL_MS });
            result.set(id, { url: null, username: null });
            continue;
        }

        const payload = await response.json().catch(() => null) as
            { username?: string; global_name?: string | null; avatar?: string | null } | null;

        const entry = {
            url: avatarUrlFor(id, payload?.avatar ?? null),
            username: payload?.global_name ?? payload?.username ?? null,
        };
        avatarCache.set(id, { ...entry, expiresAt: now + AVATAR_CACHE_TTL_MS });
        result.set(id, entry);
    }

    return result;
}
