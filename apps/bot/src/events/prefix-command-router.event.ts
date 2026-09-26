import { Events, type Message, type GuildMember } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { DEFAULT_PREFIX, STREAK_CONFIG, isChannelRestricted } from "@constants";
import { ServerConfigRepository, PunishConfigRepository } from "@database/repositories";
import { parsePrefixCommand, runPrefixShortcut } from "../utils/prefix";
import { getUserLang, t } from "../utils/lang";

const PUNISH_SHORTCUT_COMMANDS = new Set(["jail", "mute", "warn"]);

async function passesShortcutRoleGate(guildId: string, member: GuildMember): Promise<boolean> {
    const config = await PunishConfigRepository.getCached(guildId);
    return config.shortcutRoleIds.some(id => member.roles.cache.has(id));
}

async function enforceCommandsChannel(message: Message, category: string | undefined): Promise<boolean> {
    if (!isChannelRestricted(category)) return true;

    const commandsChannelId = await ServerConfigRepository.getCommandsChannel(message.guild!.id);
    if (!commandsChannelId || message.channel.id === commandsChannelId) return true;

    await message.delete().catch(() => null);

    if (message.channel.isSendable()) {
        const lang = await getUserLang(message.member as GuildMember | null);
        const notice = await message.channel
            .send({ content: t("commandsChannel.wrong_channel_notice", lang, { user: `<@${message.author.id}>`, channel: `<#${commandsChannelId}>` }) })
            .catch(() => null);
        if (notice) {
            setTimeout(() => {
                notice.delete().catch(() => null);
            }, STREAK_CONFIG.autoDeleteMs);
        }
    }

    return false;
}

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (message.author.bot || !message.guild || !message.member) return;

        const prefix = (await ServerConfigRepository.getPrefix(message.guild.id)) ?? DEFAULT_PREFIX;
        const parsed = parsePrefixCommand(message, prefix);
        if (!parsed) return;

        const { commandName, argString } = parsed;

        const command = client.commands.get(commandName);
        const messageCommand = client.messageCommands.get(commandName);
        if (!command && !messageCommand) return;

        if (PUNISH_SHORTCUT_COMMANDS.has(commandName)) {
            if (!(await passesShortcutRoleGate(message.guild.id, message.member as GuildMember))) return;
        } else if (!(await enforceCommandsChannel(message, command?.category))) {
            return;
        }

        if (messageCommand && (await messageCommand.run({ message, client, prefix, argString, command }))) return;
        if (!command) return;

        await runPrefixShortcut({ message, client, command, commandName, argString, prefix });
    },
};
