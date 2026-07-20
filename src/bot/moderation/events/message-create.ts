import { Events, type Message, type GuildTextBasedChannel, PermissionFlagsBits } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { ServerConfigRepository } from "@database/repositories/ServerConfigRepository";
import { ChatUtils } from "../utils/chat";
import { Logger } from "@core/libs";
import { runPrefixShortcut } from "@shared/utils/prefixShortcutRunner";

const CHAT_UTIL_COMMANDS = new Set(Object.keys(ChatUtils));

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (!message.guild || message.author.bot || !message.member) return;

        const shortcuts = await ServerConfigRepository.getShortcuts(message.guild.id);
        if (!shortcuts.length) return;

        const sortedShortcuts = shortcuts.sort((a, b) => b.trigger.length - a.trigger.length);
        const content = message.content.trim();
        const match = sortedShortcuts.find(s =>
            content === s.trigger ||
            content.startsWith(s.trigger + " ")
        );
        if (!match) return;

        const args = content.slice(match.trigger.length).trim();

        // Shortcuts bound to a real command (set up via /shortcut add for anything other than the
        // 6 chat-utility actions) run through the same schema-driven pipeline as !command — the
        // trigger just stands in for "prefix + command name" — so permissions match /command exactly
        // instead of being gated by the blanket ManageChannels check below.
        if (!CHAT_UTIL_COMMANDS.has(match.command)) {
            const command = client.commands.get(match.command);
            if (!command) return;
            await runPrefixShortcut(message, client, command, match.command, args, `${match.trigger} `);
            return;
        }

        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;

        const channel = message.channel as GuildTextBasedChannel;
        const commandName = match.command as keyof typeof ChatUtils;

        try {
            let result;
            switch (commandName) {
                case 'slowmode':
                    result = await ChatUtils.slowmode(channel, args || "0");
                    break;
                case 'clear':
                    const amount = parseInt(args);
                    result = await ChatUtils.clear(channel, isNaN(amount) ? 100 : amount);
                    break;
                case 'lock':
                case 'unlock':
                case 'hide':
                case 'show':
                    result = await (ChatUtils as any)[commandName](channel, message.guild);
                    break;
                default:
                    const method = (ChatUtils as any)[commandName];
                    if (typeof method === 'function') {
                        if (args) {
                            result = await method(channel, args, message.guild);
                        } else {
                            result = await method(channel, message.guild);
                        }
                    }
                    break;
            }

            if (result) {
                try {
                    if (commandName === 'clear') {
                        await channel.send({ content: `${result}` }).then(msg => {
                            setTimeout(() => msg.delete().catch(() => { }), 3000);
                        });
                    } else {
                        await message.reply({ content: `${result}` }).then(msg => {
                            setTimeout(() => msg.delete().catch(() => { }), 3000);
                        });
                    }
                } catch (error) {
                    Logger.error(`Error replying to shortcut: ${error}`, "moderation:shortcut");
                }
            }
        } catch (error) {
            Logger.error(`Error executing shortcut: ${error}`, "moderation:shortcut");
        }
    }
};
