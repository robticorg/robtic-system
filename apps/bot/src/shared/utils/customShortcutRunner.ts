import type { Message } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { ServerConfigRepository } from "@database/repositories";
import { runPrefixShortcut } from "./prefixShortcutRunner";

export interface ShortcutMatch {
    command: string;
    trigger: string;
    args: string;
}

/** Checks a message's content against this guild's configured /shortcut triggers (set up on the main bot, shared across all bots). */
export async function findShortcutMatch(guildId: string, content: string): Promise<ShortcutMatch | null> {
    const shortcuts = await ServerConfigRepository.getShortcuts(guildId);
    if (!shortcuts.length) return null;

    const sorted = [...shortcuts].sort((a, b) => b.trigger.length - a.trigger.length);
    const match = sorted.find(s => content === s.trigger || content.startsWith(s.trigger + " "));
    if (!match) return null;

    return { command: match.command, trigger: match.trigger, args: content.slice(match.trigger.length).trim() };
}

/** Runs the matched shortcut if this bot owns that command. Returns false (not true) if it doesn't — e.g. a ChatUtils-only key, or a command owned by a different bot. */
export async function runCustomCommandShortcut(message: Message, client: BotClient, match: ShortcutMatch): Promise<boolean> {
    const command = client.commands.get(match.command);
    if (!command) return false;

    await runPrefixShortcut(message, client, command, match.command, match.args, `${match.trigger} `);
    return true;
}
