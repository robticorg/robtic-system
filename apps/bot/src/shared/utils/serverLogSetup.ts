import { ChannelType, PermissionFlagsBits, type CategoryChannel, type Guild } from "discord.js";
import { Logger } from "@core/libs";
import { SERVER_LOG_CHANNELS } from "@shared/config/server-log-channels";

const CTX = "shared:server-log-setup";

/**
 * Creates (if missing) the category named after `sourceGuildId` inside `logGuild`, plus every
 * channel `sendToServerLog` expects inside it. Idempotent — safe to call repeatedly.
 */
export async function ensureServerLogChannels(logGuild: Guild, sourceGuildId: string, sourceGuildName: string): Promise<void> {
    const everyoneDeny = [{ id: logGuild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }];

    let category = logGuild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === sourceGuildId
    ) as CategoryChannel | undefined;

    if (!category) {
        category = await logGuild.channels.create({
            name: sourceGuildId,
            type: ChannelType.GuildCategory,
            permissionOverwrites: everyoneDeny,
        });
        Logger.info(`Created log category "${sourceGuildId}" in log guild for server "${sourceGuildName}"`, CTX);
    }

    const categoryId = category.id;
    for (const channelName of SERVER_LOG_CHANNELS) {
        const exists = logGuild.channels.cache.some(c => c.parentId === categoryId && c.name === channelName);
        if (exists) continue;

        await logGuild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: categoryId,
            permissionOverwrites: everyoneDeny,
        });
    }
}

/**
 * Deletes the category named after `sourceGuildId` inside `logGuild`, along with every channel
 * in it. Returns false (no-op) if no such category exists.
 */
export async function removeServerLogChannels(logGuild: Guild, sourceGuildId: string): Promise<boolean> {
    const category = logGuild.channels.cache.find(
        c => c.type === ChannelType.GuildCategory && c.name === sourceGuildId
    ) as CategoryChannel | undefined;
    if (!category) return false;

    const children = logGuild.channels.cache.filter(c => c.parentId === category!.id);
    for (const channel of children.values()) {
        await channel.delete("Source server removed the moderation bot").catch(() => null);
    }
    await category.delete("Source server removed the moderation bot").catch(() => null);

    return true;
}
