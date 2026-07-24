const DISCORD_API = "https://discord.com/api/v10";

export function botToken(): string | null {
    return process.env.MainBotToken ?? process.env.TestBot ?? null;
}

/** Thin GET against the Discord REST API using the bot token. Returns null on any non-2xx. */
export async function discordBotGet<T>(path: string): Promise<T | null> {
    const token = botToken();
    if (!token) return null;

    const response = await fetch(`${DISCORD_API}${path}`, {
        headers: { Authorization: `Bot ${token}` },
    }).catch(() => null);

    if (!response?.ok) return null;
    return response.json().catch(() => null) as Promise<T | null>;
}

/** Thin PATCH against the Discord REST API using the bot token. Returns the error body on non-2xx. */
export async function discordBotPatch<T>(
    path: string,
    body: Record<string, unknown>,
): Promise<{ ok: true; data: T | null } | { ok: false; error: string }> {
    const token = botToken();
    if (!token) return { ok: false, error: "Bot token is not configured" };

    const response = await fetch(`${DISCORD_API}${path}`, {
        method: "PATCH",
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }).catch(() => null);

    if (!response) return { ok: false, error: "Discord request failed" };
    if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        return { ok: false, error: payload?.message ?? `Discord returned ${response.status}` };
    }
    return { ok: true, data: await response.json().catch(() => null) as T | null };
}

/** Thin POST against the Discord REST API using the bot token. Returns null on any non-2xx. */
export async function discordBotPost<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
    const token = botToken();
    if (!token) return null;

    const response = await fetch(`${DISCORD_API}${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bot ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    }).catch(() => null);

    if (!response?.ok) return null;
    return response.json().catch(() => null) as Promise<T | null>;
}
