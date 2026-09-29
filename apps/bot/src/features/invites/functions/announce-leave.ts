import type { GuildMember, PartialGuildMember } from "discord.js";
import type { IInviteJoin } from "@database/models/InviteJoin";
import { inviteLogChannel } from "./invite-log-channel";
import { inviterName } from "./inviter-name";
import { invitedLeaveMessage, unknownLeaveMessage, vanityLeaveMessage } from "../utils/invite-format";

/**
 * Posts who left and who had invited them, in the same channel as join announcements. `join` is the
 * row the leave just closed; `null` when the member joined before tracking began.
 */
export async function announceLeave(member: GuildMember | PartialGuildMember, join: IInviteJoin | null): Promise<void> {
    const channel = await inviteLogChannel(member.guild);
    if (!channel) return;

    const name = member.user?.username ?? member.id;

    let content: string;
    if (join?.source === "vanity") content = vanityLeaveMessage(name);
    else if (join?.inviterId) content = invitedLeaveMessage(name, await inviterName(member.client, join.inviterId));
    else content = unknownLeaveMessage(name);

    await channel.send({ content, allowedMentions: { parse: [] } });
}
