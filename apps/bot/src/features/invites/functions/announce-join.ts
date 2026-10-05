import type { Guild } from "discord.js";
import type { DetectedInviteUse } from "@core/invites";
import { inviteLogChannel } from "./invite-log-channel";
import { inviterName } from "./inviter-name";
import { invitesBackend } from "./invites-backend";
import { invitedJoinMessage, unknownJoinMessage, vanityJoinMessage } from "../utils/invite-format";

/**
 * Posts who just joined and how, in the guild's `/invites-config channel`. Silent when there is
 * nowhere to post. Nobody is pinged: the mention only renders the name.
 *
 * Called from the `discord-outbox` queue after the worker recorded the join (or inline when Redis
 * isn't configured). Throws if the inviter's count can't be read, so the queue retries it.
 */
export async function announceJoin(guild: Guild, memberId: string, used: DetectedInviteUse | null, requestId?: string): Promise<void> {
    const channel = await inviteLogChannel(guild);
    if (!channel) return;

    let content: string;
    if (used?.vanity) {
        content = vanityJoinMessage(memberId, used.code);
    } else if (used?.inviterId) {
        const [name, stats] = await Promise.all([inviterName(guild.client, used.inviterId), invitesBackend.stats(guild.id, used.inviterId, requestId)]);
        content = invitedJoinMessage(memberId, name, stats.total);
    } else {
        content = unknownJoinMessage(memberId);
    }

    await channel.send({ content, allowedMentions: { parse: [] } });
}
