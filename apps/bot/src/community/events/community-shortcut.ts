import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { DEFAULT_PREFIX } from "@constants";
import { ServerConfigRepository } from "@database/repositories";
import { parsePrefixCommand, runPrefixShortcut } from "@shared/utils/prefix";

// Generic prefix router for the community bot — every slash command (leaderboard, level,
// level-rewards, xp-settings) is also usable as `!command`, gated by its own checkPermissions
// exactly like `/command`. Separate listener from message-create.ts (XP/support tracking).
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
