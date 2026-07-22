import { Events, type Message, type GuildMember } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { DEFAULT_PREFIX } from "@constants";
import { ServerConfigRepository, PunishConfigRepository } from "@database/repositories";
import { parsePrefixCommand, runPrefixShortcut } from "@shared/utils/prefix";

const SHORTCUT_COMMANDS = new Set(["ban", "mute", "warn"]);

// Separate listener from moderation-shortcut.ts — only ban/mute/warn, gated by PunishConfig's
// shortcutRoleIds, since these three carry the extra proof-of-evidence flow (see ban/mute/warn's isPrefix handling).
export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (message.author.bot || !message.guild || !message.member) return;

        const prefix = (await ServerConfigRepository.getPrefix(message.guild.id)) ?? DEFAULT_PREFIX;
        const parsed = parsePrefixCommand(message, prefix);
        if (!parsed) return;
        const { commandName, argString } = parsed;
        if (!SHORTCUT_COMMANDS.has(commandName)) return;

        const config = await PunishConfigRepository.getCached(message.guild.id);
        const member = message.member as GuildMember;
        const allowed = config.shortcutRoleIds.some(id => member.roles.cache.has(id));
        if (!allowed) return;

        const command = client.commands.get(commandName);
        if (!command) return;

        await runPrefixShortcut(message, client, command, commandName, argString, prefix);
    },
};
