import { AuditLogEvent, EmbedBuilder, Events, type GuildChannel } from "discord.js";
import { COLORS } from "@constants";
import { recordSecurityEvent, sendAuditLog } from "../../utils/moderation/security";
import type { BotClient } from "@core/bot-client";
import { sendToServerLog } from "@bot/utils/server-log";

import { L } from "@utils";
export default {
    name: Events.ChannelDelete,
    async execute(channel: GuildChannel, client: BotClient) {
        const logs = await channel.guild.fetchAuditLogs({ type: AuditLogEvent.ChannelDelete, limit: 6 }).catch(() => null);
        const entry = logs?.entries.find((item) => Date.now() - item.createdTimestamp < 15_000);
        const executorId = entry?.executor?.id;

        const embed = new EmbedBuilder()
            .setTitle(L("📘 Channel deleted", "📘 حذف روم"))
            .setColor(COLORS.error)
            .addFields(
                { name: L("Channel", "الروم"), value: `${channel.name} (${channel.id})` },
                { name: L("Type", "النوع"), value: channel.type.toString(), inline: true },
                { name: L("By", "بواسطة"), value: executorId ? `<@${executorId}> (${executorId})` : L("Unknown", "غير معروف"), inline: true },
            )
            .setTimestamp();

        await sendAuditLog(channel.guild, "channel_delete", embed);
        await sendToServerLog(client, channel.guild.id, "channel-delete", embed);

        if (executorId) {
            await recordSecurityEvent({
                client,
                guild: channel.guild,
                event: "channel_delete",
                executorId,
                targetId: channel.id,
                source: "event:channelDelete",
                details: `channel=${channel.name}`,
            });
        }
    },
};
