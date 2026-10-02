import { ChannelType, type CategoryChannel, type Guild } from "discord.js";
import { SERVER_LOG_MESSAGES } from "@constants";

export async function removeServerLogChannels(logGuild: Guild, sourceGuildId: string): Promise<boolean> {
    const category = logGuild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === sourceGuildId
    ) as CategoryChannel | undefined;
    if (!category) return false;

    const children = logGuild.channels.cache.filter(c => c.parentId === category!.id);
    for (const channel of children.values()) {
        await channel.delete(SERVER_LOG_MESSAGES.categoryRemovedReason).catch(() => null);
    }
    await category.delete(SERVER_LOG_MESSAGES.categoryRemovedReason).catch(() => null);

    return true;
}
