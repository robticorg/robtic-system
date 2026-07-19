import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { DEFAULT_PREFIX } from "@core/config";
import { ServerConfigRepository } from "@database/repositories";
import { parsePrefixCommand, runPrefixShortcut } from "@shared/utils/prefixShortcutRunner";

// ban/mute/warn have their own dedicated router (punish-shortcut.ts). Every other moderation
// command is handled here, gated by its own normal checkPermissions — same as `/command`.
const HANDLED_ELSEWHERE = new Set(["ban", "mute", "warn"]);

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (message.author.bot || !message.guild) return;

        const prefix = (await ServerConfigRepository.getPrefix(message.guild.id)) ?? DEFAULT_PREFIX;
        const parsed = parsePrefixCommand(message, prefix);
        if (!parsed) return;
        const { commandName, argString } = parsed;
        if (HANDLED_ELSEWHERE.has(commandName)) return;

        const command = client.commands.get(commandName);
        if (!command) return;

        await runPrefixShortcut(message, client, command, commandName, argString, prefix);
    },
};
