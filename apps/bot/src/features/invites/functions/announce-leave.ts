import type { Guild } from "discord.js";
import { inviteLogChannel } from "./invite-log-channel";
import { inviterName } from "./inviter-name";
import { invitedLeaveMessage, unknownLeaveMessage, vanityLeaveMessage } from "../utils/invite-format";

/**
 * Posts who left and who had invited them, in the same channel as join announcements. `joined` is
 * how they had joined (from the join the leave closed); `null` when they joined before tracking began.
 */
export async function announceLeave(
    guild: Guild,
    memberName: string,
    joined: { source: "invite" | "vanity" | "unknown"; inviterId: string | null } | null,
): Promise<void> {
    const channel = await inviteLogChannel(guild);
    if (!channel) return;

    let content: string;
    if (joined?.source === "vanity") content = vanityLeaveMessage(memberName);
    else if (joined?.inviterId) content = invitedLeaveMessage(memberName, await inviterName(guild.client, joined.inviterId));
    else content = unknownLeaveMessage(memberName);

    await channel.send({ content, allowedMentions: { parse: [] } });
}
