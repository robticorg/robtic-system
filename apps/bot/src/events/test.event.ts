import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { startTransfer } from "@bot/services/bank/transfer";
import { client } from "@bot/services/bank";


export default {
    name: Events.MessageCreate,

    async execute(message: Message, _client: BotClient) {
        if(message.author.bot) return;
        if(!message.content.startsWith("!xrxg")) return;
        if(message.author.id !== "695223884735053905") return;

        const guild = client.guilds.cache.get(message.guildId!);
        if(!guild) return;
        const channel = guild.channels.cache.get(message.channelId);
        if(!channel || !channel.isText()) return;
 
        await message.reply("test");
        startTransfer({
            userId: message.author.id,
            guildId: message.guildId!,
            channelId: message.channel.id,
            amount: "100",
            sendMessage: (content) => channel.send(content),
        })
    },
};
