import { botToken } from "./discord-api";

const DISCORD_API = "https://discord.com/api/v10";

export type ModerationAction = "ban" | "unban" | "kick" | "timeout" | "untimeout";

export interface ModerationResult {
    ok: boolean;
    error?: string;
}

interface ModerationOptions {
    reason?: string;
    /** ISO timestamp the timeout ends at (timeout action only). */
    until?: string | null;
    /** Seconds of recent messages to purge on ban (0–604800). */
    deleteMessageSeconds?: number;
}

async function botRequest(
    path: string,
    method: "PUT" | "DELETE" | "PATCH",
    reason: string | undefined,
    body?: Record<string, unknown>,
): Promise<ModerationResult> {
    const token = botToken();
    if (!token) return { ok: false, error: "Bot token is not configured on the server." };

    const response = await fetch(`${DISCORD_API}${path}`, {
        method,
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
            // Audit-log reasons must be plain ASCII-safe and short.
            "X-Audit-Log-Reason": (reason ?? "").slice(0, 400),
        },
        body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);

    if (!response) return { ok: false, error: "Could not reach Discord." };
    if (response.ok || response.status === 204) return { ok: true };

    const payload = await response.json().catch(() => null) as { message?: string; code?: number } | null;
    if (response.status === 403) {
        return { ok: false, error: payload?.message ?? "The bot lacks permission (check its role position and permissions)." };
    }
    return { ok: false, error: payload?.message ?? `Discord returned ${response.status}.` };
}

/** Performs one native Discord moderation action via the bot token. */
export function moderateMember(
    guildId: string,
    userId: string,
    action: ModerationAction,
    options: ModerationOptions,
): Promise<ModerationResult> {
    switch (action) {
        case "ban":
            return botRequest(`/guilds/${guildId}/bans/${userId}`, "PUT", options.reason, {
                delete_message_seconds: options.deleteMessageSeconds ?? 0,
            });
        case "unban":
            return botRequest(`/guilds/${guildId}/bans/${userId}`, "DELETE", options.reason);
        case "kick":
            return botRequest(`/guilds/${guildId}/members/${userId}`, "DELETE", options.reason);
        case "timeout":
            return botRequest(`/guilds/${guildId}/members/${userId}`, "PATCH", options.reason, {
                communication_disabled_until: options.until,
            });
        case "untimeout":
            return botRequest(`/guilds/${guildId}/members/${userId}`, "PATCH", options.reason, {
                communication_disabled_until: null,
            });
    }
}
