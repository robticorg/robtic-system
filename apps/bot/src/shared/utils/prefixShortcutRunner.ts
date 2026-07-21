import type { Message } from "discord.js";
import type { BotClient } from "@core/BotClient";
import type { CommandConfig } from "@core/config";
import { checkPermissions, cooldowns, commandError, releaseCooldown } from "./interaction-helper";
import { buildPrefixInteraction } from "./prefixArgs";

/** Splits a message into `{commandName, argString}` if it starts with the guild's prefix, else null. */
export function parsePrefixCommand(message: Message, prefix: string): { commandName: string; argString: string } | null {
    if (!message.content.startsWith(prefix)) return null;

    const withoutPrefix = message.content.slice(prefix.length);
    const spaceIdx = withoutPrefix.search(/\s/);
    const commandName = (spaceIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, spaceIdx)).toLowerCase();
    if (!commandName) return null;

    const argString = spaceIdx === -1 ? "" : withoutPrefix.slice(spaceIdx + 1);
    return { commandName, argString };
}

/** Shared by every bot's shortcut listener — runs the same checkPermissions/cooldowns/run pipeline a real slash invocation would use. */
export async function runPrefixShortcut(
    message: Message,
    client: BotClient,
    command: CommandConfig,
    commandName: string,
    argString: string,
    prefix: string,
): Promise<void> {
    if (command.modalOnly) {
        await message
            .reply({ content: `\`${commandName}\` needs its form fields — use \`/${commandName}\` instead.`, allowedMentions: { repliedUser: false } })
            .catch(() => null);
        return;
    }

    if (typeof (command.data as any).toJSON !== "function") return;

    const { interaction, error } = await buildPrefixInteraction(message, client, command, argString, prefix);
    if (error) {
        await message.reply({ content: error, allowedMentions: { repliedUser: false } }).catch(() => null);
        return;
    }

    try {
        const hasPerms = await checkPermissions(interaction, command);
        if (!hasPerms) return;

        const canProceed = await cooldowns(interaction, command, client);
        if (!canProceed) return;

        try {
            await command.run(interaction, client);
        } catch (err) {
            releaseCooldown(interaction, client);
            throw err;
        }
    } catch (err) {
        await commandError(err, interaction, client);
    }
}
