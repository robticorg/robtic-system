import type { Guild, SendableChannels } from "discord.js";
import { isFeatureEnabled } from "@core/features";
import { ServerConfigRepository } from "@database/repositories";

/**
 * Where joins and leaves are announced: the `/invites-config channel`. `null` when no channel is
 * set, the channel is gone, or the feature is disabled — tracking carries on regardless.
 */
export async function inviteLogChannel(guild: Guild): Promise<SendableChannels | null> {
    const channelId = await ServerConfigRepository.getInviteLogChannel(guild.id);
    if (!channelId || !(await isFeatureEnabled(guild.id, "invites"))) return null;

    const channel = guild.channels.cache.get(channelId);
    return channel?.isSendable() ? channel : null;
}
