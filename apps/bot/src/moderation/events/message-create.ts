import { Events, type Message, type GuildTextBasedChannel, PermissionFlagsBits } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { ChatUtils } from "../utils/chat";
import { Logger } from "@logger";
import { findShortcutMatch, runCustomCommandShortcut } from "@shared/utils/prefix";
import { hasFullPower } from "@shared/utils/access";

const CHAT_UTIL_COMMANDS = new Set(Object.keys(ChatUtils));

export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (!message.guild || message.author.bot || !message.member) return;

        const content = message.content.trim();
        const match = await findShortcutMatch(message.guild.id, content);
        if (!match) return;

        // Real-command shortcuts (anything set up via /shortcut add other than the 6 chat-utility
        // actions) run through the same schema-driven pipeline as !command, with that command's own
        // permission check instead of the blanket ManageChannels gate below.
        if (!CHAT_UTIL_COMMANDS.has(match.command)) {
            await runCustomCommandShortcut(message, client, match);
            return;
        }

        if (!hasFullPower(message.member) && !message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return;

        const channel = message.channel as GuildTextBasedChannel;
        const commandName = match.command as keyof typeof ChatUtils;
        const args = match.args;

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
