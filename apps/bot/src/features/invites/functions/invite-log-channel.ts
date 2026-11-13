import type { Guild, SendableChannels } from "discord.js";
import { isFeatureEnabled } from "@core/features";
import { ServerConfigRepository } from "@database/repositories";

/**
 * Where a join or a leave is announced, and the server's custom texts (dashboard → Invites). Joins go to the
 * `/invites-config channel`; leaves to their own channel, or the join one. `channel` is `null` when none is set, it's
 * gone, or the feature is disabled: tracking carries on regardless.
 */
export async function inviteLogChannel(guild: Guild, kind: "join" | "leave" = "join"): Promise<{ channel: SendableChannels | null; messages: Record<string, string> }> {
    const config = await ServerConfigRepository.getInviteConfig(guild.id);
    const channelId = kind === "join" ? config.joinChannelId : config.leaveChannelId;
    if (!channelId || !(await isFeatureEnabled(guild.id, "invites"))) return { channel: null, messages: config.messages };

    const channel = guild.channels.cache.get(channelId);
    return { channel: channel?.isSendable() ? channel : null, messages: config.messages };
}
