import { PermissionFlagsBits, type Guild, type GuildTextBasedChannel } from "discord.js";
import { ServerConfigRepository } from "@database/repositories";

const NEEDED = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles];

/** Why the bot can't post in `channel`, or `null` when it can. */
export function partnerChannelProblem(channel: GuildTextBasedChannel): string | null {
    const me = channel.guild.members.me;
    const perms = me ? channel.permissionsFor(me) : null;
    if (!perms || !NEEDED.every(p => perms.has(p))) {
        return `I need **View Channel**, **Send Messages** and **Attach Files** in <#${channel.id}>.`;
    }
    return null;
}

/** The configured partner channel, or a message saying what's wrong with it. */
export async function resolvePartnerChannel(guild: Guild): Promise<{ channel: GuildTextBasedChannel } | { problem: string }> {
    const channelId = await ServerConfigRepository.getPartnerChannel(guild.id);
    if (!channelId) return { problem: "No partner channel is set. Run `/partner channel` first." };

    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased() || channel.isDMBased()) {
        return { problem: "The partner channel no longer exists. Set it again with `/partner channel`." };
    }

    const problem = partnerChannelProblem(channel);
    return problem ? { problem } : { channel };
}
