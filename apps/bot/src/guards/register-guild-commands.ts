import type { BotClient } from "@core/bot-client";
import { clearGuildCommands, publishGuildCommands } from "@core/registration";

/**
 * Slash commands for one whitelisted server, right now — after `!guild <id> add`, or when the bot
 * joins a whitelisted server. (Deploys and restarts re-register every whitelisted server.)
 */
export async function registerGuildCommands(client: BotClient, guildId: string): Promise<"published" | "not-joined" | "failed" | "dev-mode"> {
    if (!client.user) return "failed";
    return publishGuildCommands(client.rest_(), client.user.id, client.commands, client.botName, guildId);
}

export async function unregisterGuildCommands(client: BotClient, guildId: string): Promise<void> {
    if (!client.user) return;
    await clearGuildCommands(client.rest_(), client.user.id, client.botName, guildId);
}
