import type { Message } from "discord.js";
import type { BotClient } from "@core/bot-client";
import type { CommandConfig } from "@typings/command";
import { PREFIX_MESSAGES } from "@constants";
import { checkPermissions, cooldowns, commandError, releaseCooldown } from "@shared/utils/interaction";
import { buildPrefixInteraction } from "./build-prefix-interaction";

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
            .reply({ content: PREFIX_MESSAGES.modalOnlyCommand(commandName), allowedMentions: { repliedUser: false } })
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
