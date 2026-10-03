const API = "https://discord.com/api/v10";

export interface BotAccount {
    botId: string;
    applicationId: string;
    username: string;
}

/** A bot token always looks like this: three dot-separated base64url parts. Checked before any request. */
export function looksLikeBotToken(token: string): boolean {
    return /^[\w-]{20,}\.[\w-]{4,}\.[\w-]{20,}$/.test(token.trim());
}

/**
 * Asks Discord who a token belongs to, without logging in to the gateway. `null` when the token is
 * invalid, or belongs to a user rather than a bot.
 */
export async function inspectBotToken(token: string, fetcher: typeof fetch = fetch): Promise<BotAccount | null> {
    const headers = { Authorization: `Bot ${token.trim()}` };
    const [me, app] = await Promise.all([
        fetcher(`${API}/users/@me`, { headers }).catch(() => null),
        fetcher(`${API}/oauth2/applications/@me`, { headers }).catch(() => null),
    ]);
    if (!me?.ok || !app?.ok) return null;

    const user = await me.json() as { id: string; username: string; bot?: boolean };
    const application = await app.json() as { id: string };
    if (!user.bot) return null;

    return { botId: user.id, applicationId: application.id, username: user.username };
}

/**
 * The invite for a music bot: no server-wide permissions at all (`permissions=0`), locked to one
 * guild. What it may do is granted afterwards on its own voice channel only.
 */
export function musicBotInviteUrl(applicationId: string, guildId: string): string {
    const params = new URLSearchParams({
        client_id: applicationId,
        scope: "bot",
        permissions: "0",
        guild_id: guildId,
        disable_guild_select: "true",
    });
    return `https://discord.com/oauth2/authorize?${params}`;
}
