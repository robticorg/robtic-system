import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { findShortcutMatch, runCustomCommandShortcut } from "@shared/utils/customShortcutRunner";

/** Lets /shortcut add (main bot) target hr commands too — e.g. a custom trigger for staff-warn. */
export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (!message.guild || message.author.bot || !message.member) return;

        const match = await findShortcutMatch(message.guild.id, message.content.trim());
        if (!match) return;

        await runCustomCommandShortcut(message, client, match);
    },
};
