import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/BotClient";
import { findShortcutMatch, runCustomCommandShortcut } from "@shared/utils/customShortcutRunner";

/** Lets /shortcut add target main bot's own commands too, not just moderation/hr. */
export default {
    name: Events.MessageCreate,
    async execute(message: Message, client: BotClient) {
        if (!message.guild || message.author.bot || !message.member) return;

        const match = await findShortcutMatch(message.guild.id, message.content.trim());
        if (!match) return;

        await runCustomCommandShortcut(message, client, match);
    },
};
