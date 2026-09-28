import type { GuildMember } from "discord.js";
import type { InviteUseSnapshot } from "@core/rewards";
import { isFeatureEnabled } from "@core/features";
import { ServerConfigRepository } from "@database/repositories";
import { getInviteStats } from "./get-invite-stats";
import { invitedJoinMessage, unknownJoinMessage, vanityJoinMessage } from "../utils/invite-format";

async function inviterName(member: GuildMember, inviterId: string): Promise<string> {
    const cached = member.guild.members.cache.get(inviterId)?.user ?? member.client.users.cache.get(inviterId);
    const user = cached ?? await member.client.users.fetch(inviterId).catch(() => null);
    return user?.username ?? "Unknown user";
}

/**
 * Posts who just joined and how, in the guild's `/invites-config channel`. Silent when no channel
 * is set, the channel is gone, or the feature is disabled — the join is recorded either way.
 * Nobody is pinged: the mention only renders the name.
 */
export async function announceJoin(member: GuildMember, used: InviteUseSnapshot | null): Promise<void> {
    const guildId = member.guild.id;
    const channelId = await ServerConfigRepository.getInviteLogChannel(guildId);
    if (!channelId || !(await isFeatureEnabled(guildId, "invites"))) return;

    const channel = member.guild.channels.cache.get(channelId);
    if (!channel?.isSendable()) return;

    let content: string;
    if (used?.vanity) {
        content = vanityJoinMessage(member.id, used.code);
    } else if (used?.inviterId) {
        const [name, stats] = await Promise.all([inviterName(member, used.inviterId), getInviteStats(guildId, used.inviterId)]);
        content = invitedJoinMessage(member.id, name, stats.total);
    } else {
        content = unknownJoinMessage(member.id);
    }

    await channel.send({ content, allowedMentions: { parse: [] } });
}
