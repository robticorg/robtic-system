import { EmbedBuilder, Events, type Message } from "discord.js";
import type { BotClient } from "@core/bot-client";
import { COLORS } from "@constants";
import { sendToServerLog } from "@bot/utils/server-log";

import { L } from "@utils";
export default {
    name: Events.MessageUpdate,
    async execute(oldMessage: Message, newMessage: Message, client: BotClient) {
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const truncate = (s: string, max = 1024) => s.length > max ? s.slice(0, max - 3) + "..." : s;

        const embed = new EmbedBuilder()
            .setTitle(L("📘 Message edited", "📘 تعديل رسالة"))
            .setColor(COLORS.warning)
            .addFields(
                { name: L("Author", "الكاتب"), value: `<@${newMessage.author.id}> (\`${newMessage.author.id}\`)`, inline: true },
                { name: L("Channel", "الروم"), value: `${newMessage.channel.toString()} (\`${newMessage.channelId}\`)`, inline: true },
                { name: L("Before", "قبل"), value: truncate(oldMessage.content || L("(empty)", "(فارغة)")) },
                { name: L("After", "بعد"), value: truncate(newMessage.content || L("(empty)", "(فارغة)")) },
                { name: L("Link", "الرابط"), value: L(`[Jump to message](${newMessage.url})`, `[الذهاب للرسالة](${newMessage.url})`), inline: true },
            )
            .setTimestamp();

        await sendToServerLog(client, newMessage.guild.id, "message-update", embed);
    },
};
