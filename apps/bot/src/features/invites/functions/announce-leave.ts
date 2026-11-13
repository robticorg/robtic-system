import type { Guild } from "discord.js";
import { inviteLogChannel } from "./invite-log-channel";
import { inviterName } from "./inviter-name";
import { invitesBackend } from "./invites-backend";
import { fillInviteText, invitedLeaveMessage, unknownLeaveMessage, vanityLeaveMessage } from "../utils/invite-format";

/**
 * Posts who left and who had invited them, in the same channel as join announcements. `joined` is
 * how they had joined (from the join the leave closed); `null` when they joined before tracking began.
 */
export async function announceLeave(
    guild: Guild,
    memberName: string,
    joined: { source: "invite" | "vanity" | "unknown"; inviterId: string | null } | null,
): Promise<void> {
    const { channel, messages } = await inviteLogChannel(guild, "leave");
    if (!channel) return;

    // They're gone, so [user] is their name rather than a mention.
    const base = { user: memberName, username: memberName, inviter: "", invites: 0, code: "", server: guild.name, members: guild.memberCount };
    let content: string;
    if (joined?.source === "vanity") {
        content = messages.leaveVanity ? fillInviteText(messages.leaveVanity, base) : vanityLeaveMessage(memberName);
    } else if (joined?.inviterId) {
        const name = await inviterName(guild.client, joined.inviterId);
        if (messages.leaveInvited) {
            const invites = messages.leaveInvited.includes("[invites]") ? (await invitesBackend.stats(guild.id, joined.inviterId).catch(() => null))?.total ?? 0 : 0;
            content = fillInviteText(messages.leaveInvited, { ...base, inviter: name, invites });
        } else content = invitedLeaveMessage(memberName, name);
    } else {
        content = messages.leaveUnknown ? fillInviteText(messages.leaveUnknown, base) : unknownLeaveMessage(memberName);
    }

    await channel.send({ content, allowedMentions: { parse: [] } });
}
