import { type Client, type TextChannel } from "discord.js";
import { LogConfigRepository } from "@database/repositories";
import type { LogKey } from "@constants";

/**
 * The channel for a kind of log. Pass the server the event happened in: its own log channel wins, otherwise the
 * shared one from /setup-log. Leave it out only for bot-wide logs (the guard), which always use the shared row.
 */
export async function getLogChannel(client: Client, key: LogKey, guildId?: string | null): Promise<TextChannel | null> {
    const config = await LogConfigRepository.findFor(key, guildId);
    if (!config) return null;
    return (client.channels.cache.get(config.channelId) as TextChannel | undefined) ?? null;
}
