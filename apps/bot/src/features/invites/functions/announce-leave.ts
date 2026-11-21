import { announcePayload, isAnnounceFormat } from "@bot/utils/announce-format";
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
    const { channel, messages, formats, color } = await inviteLogChannel(guild, "leave");
    if (!channel) return;

    // They're gone, so [user] is their name rather than a mention.
    const base = { user: memberName, username: memberName, inviter: "", invites: 0, code: "", server: guild.name, members: guild.memberCount };
    let content: string;
    let key: string;
    if (joined?.source === "vanity") {
        key = "leaveVanity";
        content = messages.leaveVanity ? fillInviteText(messages.leaveVanity, base) : vanityLeaveMessage(memberName);
    } else if (joined?.inviterId) {
        key = "leaveInvited";
        const name = await inviterName(guild.client, joined.inviterId);
        if (messages.leaveInvited) {
            const invites = messages.leaveInvited.includes("[invites]") ? (await invitesBackend.stats(guild.id, joined.inviterId).catch(() => null))?.total ?? 0 : 0;
            content = fillInviteText(messages.leaveInvited, { ...base, inviter: name, invites });
        } else content = invitedLeaveMessage(memberName, name);
    } else {
        key = "leaveUnknown";
        content = messages.leaveUnknown ? fillInviteText(messages.leaveUnknown, base) : unknownLeaveMessage(memberName);
    }

    const format = formats[key];
    await channel.send(announcePayload(content, isAnnounceFormat(format) ? format : "text", color));
}
