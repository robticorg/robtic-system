import { PermissionsBitField } from "discord.js";
import { MUSIC_CONFIG } from "@constants";

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

/** What a roaming music bot is invited with: join, speak and post its card in any voice channel. Nothing that manages. */
export const ROAMING_PERMISSIONS = PermissionsBitField.resolve([...MUSIC_CONFIG.channelPermissions]).toString();

/**
 * The invite for a music bot, locked to one guild. A fixed bot asks for no server-wide permissions at all
 * (`permissions=0`): what it may do is granted afterwards on its own voice channel only. A roaming bot moves between
 * channels, so it asks for the same few voice permissions server-wide.
 */
export function musicBotInviteUrl(applicationId: string, guildId: string, mode: "fixed" | "roaming" = "fixed"): string {
    const params = new URLSearchParams({
        client_id: applicationId,
        scope: "bot",
        permissions: mode === "roaming" ? ROAMING_PERMISSIONS : "0",
        guild_id: guildId,
        disable_guild_select: "true",
    });
    return `https://discord.com/oauth2/authorize?${params}`;
}
