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
