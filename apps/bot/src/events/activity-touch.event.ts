import { Events, type Message, type MessageReaction, type User } from "discord.js";
import { touchActivity } from "@core/activity";

export default [
    {
        name: Events.MessageCreate,
        execute: (message: Message) => {
            if (message.author.bot || !message.guild) return;
            touchActivity(message.guild.id, message.author.id, "message");
        },
    },
    {
        name: Events.MessageReactionAdd,
        execute: (reaction: MessageReaction, user: User) => {
            const guildId = reaction.message.guild?.id;
            if (!guildId || user.bot) return;
            touchActivity(guildId, user.id, "reaction");
        },
    },
];
