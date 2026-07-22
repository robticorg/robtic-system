const DISCORD_USER_URL = "https://discord.com/api/users/@me";
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;

export interface AuthenticatedUser {
    id: string;
    username: string;
    avatarUrl: string | null;
}

const tokenCache = new Map<string, { user: AuthenticatedUser; expiresAt: number }>();

function avatarUrlFor(id: string, avatar: string | null): string | null {
    if (!avatar) return null;
    const ext = avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`;
}

/**
 * Resolves the caller from their Discord OAuth token. The Activity never tells us who it is —
 * identity always comes from Discord, so a client can't ask for another user's private data by
 * claiming their id.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | null> {
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return null;

    const token = header.slice("Bearer ".length).trim();
    if (!token) return null;

    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) return cached.user;

    const response = await fetch(DISCORD_USER_URL, {
        headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

    if (!response?.ok) return null;

    const payload = await response.json().catch(() => null) as
        { id?: string; username?: string; global_name?: string | null; avatar?: string | null } | null;
    if (!payload?.id) return null;

    const user: AuthenticatedUser = {
        id: payload.id,
        username: payload.global_name ?? payload.username ?? payload.id,
        avatarUrl: avatarUrlFor(payload.id, payload.avatar ?? null),
    };

    tokenCache.set(token, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS });
    return user;
}
