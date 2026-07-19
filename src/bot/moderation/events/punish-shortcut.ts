import { Events, type Message, type GuildMember } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { DEFAULT_PREFIX } from "@core/config";
import { ServerConfigRepository, PunishConfigRepository } from "@database/repositories";
import { checkPermissions, cooldowns, commandError, releaseCooldown } from "@shared/utils/interaction-helper";
import { buildPrefixInteraction } from "@shared/utils/prefixArgs";

const SHORTCUT_COMMANDS = new Set(["ban", "mute", "warn"]);

/**
 * A separate MessageCreate listener from message-create.ts's ChatUtils shortcut dispatcher —
 * discord.js allows multiple listeners per event, so this coexists safely. Only ban/mute/warn are
 * prefix-invokable here, and only for members holding one of PunishConfig's shortcutRoleIds; the
 * command's own requiredPermission/department checks still apply on top via checkPermissions.
 */
export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (message.author.bot || !message.guild || !message.member) return;

        const prefix = (await ServerConfigRepository.getPrefix(message.guild.id)) ?? DEFAULT_PREFIX;
        if (!message.content.startsWith(prefix)) return;

        const withoutPrefix = message.content.slice(prefix.length);
        const spaceIdx = withoutPrefix.search(/\s/);
        const commandName = (spaceIdx === -1 ? withoutPrefix : withoutPrefix.slice(0, spaceIdx)).toLowerCase();
        if (!SHORTCUT_COMMANDS.has(commandName)) return;
        const argString = spaceIdx === -1 ? "" : withoutPrefix.slice(spaceIdx + 1);

        const config = await PunishConfigRepository.getCached(message.guild.id);
        const member = message.member as GuildMember;
        const allowed = config.shortcutRoleIds.some(id => member.roles.cache.has(id));
        if (!allowed) return;

        const command = client.commands.get(commandName);
        if (!command) return;

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
    },
};
