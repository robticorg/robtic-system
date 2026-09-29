import type { GuildMember } from "discord.js";
import type { InviteUseSnapshot } from "@core/rewards";
import { getInviteStats } from "./get-invite-stats";
import { inviteLogChannel } from "./invite-log-channel";
import { inviterName } from "./inviter-name";
import { invitedJoinMessage, unknownJoinMessage, vanityJoinMessage } from "../utils/invite-format";

/**
 * Posts who just joined and how, in the guild's `/invites-config channel`. Silent when there is
 * nowhere to post — the join is recorded either way. Nobody is pinged: the mention only renders
 * the name.
 */
export async function announceJoin(member: GuildMember, used: InviteUseSnapshot | null): Promise<void> {
    const channel = await inviteLogChannel(member.guild);
    if (!channel) return;

    let content: string;
    if (used?.vanity) {
        content = vanityJoinMessage(member.id, used.code);
    } else if (used?.inviterId) {
        const [name, stats] = await Promise.all([inviterName(member.client, used.inviterId), getInviteStats(member.guild.id, used.inviterId)]);
        content = invitedJoinMessage(member.id, name, stats.total);
    } else {
        content = unknownJoinMessage(member.id);
    }

    await channel.send({ content, allowedMentions: { parse: [] } });
}
