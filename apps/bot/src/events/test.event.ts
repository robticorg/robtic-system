import { Events, type Message } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { startTransfer } from "@bot/services/bank/transfer";


export default {
    name: Events.MessageCreate,

    async execute(message: Message, _client: BotClient) {
        if(message.author.bot) return;
        if(!message.content.startsWith("!xrxg")) return;

        const channel = _client.channels.cache.get(message.channelId);
        if(!channel || !channel.isSendable()) return;
 
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
