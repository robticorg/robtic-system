import { Events, type Message, type GuildMember } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { DEFAULT_PREFIX } from "@constants";
import { ServerConfigRepository, HrConfigRepository } from "@database/repositories";
import { parsePrefixCommand, runPrefixShortcut } from "@shared/utils/prefix";

/** Same schema-driven prefix plumbing as moderation's punish-shortcut.ts, restricted to staff-warn (its own separate shortcut-role gate — see hr-shortcut.ts for every other hr command). */
export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (message.author.bot || !message.guild || !message.member) return;

        const prefix = (await ServerConfigRepository.getPrefix(message.guild.id)) ?? DEFAULT_PREFIX;
        const parsed = parsePrefixCommand(message, prefix);
        if (!parsed) return;
        const { commandName, argString } = parsed;
        if (commandName !== "staff-warn") return;

        const config = await HrConfigRepository.getCached(message.guild.id);
        const member = message.member as GuildMember;
        const allowed = config.staffWarnShortcutRoleIds.some(id => member.roles.cache.has(id));
        if (!allowed) return;

        const command = client.commands.get(commandName);
        if (!command) return;

        await runPrefixShortcut(message, client, command, commandName, argString, prefix);
    },
};
