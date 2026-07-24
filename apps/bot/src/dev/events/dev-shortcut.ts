import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { DEFAULT_PREFIX } from "@constants";
import { ServerConfigRepository } from "@database/repositories";
import { parsePrefixCommand, runPrefixShortcut } from "@shared/utils/prefix";

// Generic prefix router for the dev bot — makes `!help` (and any future non-modal command) work.
export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (message.author.bot || !message.guild) return;

        const prefix = (await ServerConfigRepository.getPrefix(message.guild.id)) ?? DEFAULT_PREFIX;
        const parsed = parsePrefixCommand(message, prefix);
        if (!parsed) return;
        const { commandName, argString } = parsed;

        const command = client.commands.get(commandName);
        if (!command) return;

        await runPrefixShortcut(message, client, command, commandName, argString, prefix);
    },
};
