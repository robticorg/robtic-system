import { Events, type Message, type GuildMember } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { DEFAULT_PREFIX, STREAK_CONFIG } from "@core/config";
import { ServerConfigRepository } from "@database/repositories";
import { parsePrefixCommand, runPrefixShortcut } from "@shared/utils/prefixShortcutRunner";
import { getUserLang, t } from "@shared/utils/lang";

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

        // Main-bot commands are only allowed in the configured commands channel, if one is set —
        // anywhere else, the triggering message is removed instead of running the command.
        const commandsChannelId = await ServerConfigRepository.getCommandsChannel(message.guild.id);
        if (commandsChannelId && message.channel.id !== commandsChannelId) {
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
            return;
        }

        await runPrefixShortcut(message, client, command, commandName, argString, prefix);
    },
};
