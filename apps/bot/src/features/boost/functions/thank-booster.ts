import type { Guild } from "discord.js";
import { BOOST_CONFIG } from "@constants";
import { isFeatureEnabled } from "@core/features";
import { ServerConfigRepository } from "@database/repositories";
import { boostThanksMessage } from "../utils/boost-message";

const recentlyThanked = new Map<string, number>();

async function resolveEmoji(guild: Guild): Promise<string> {
    const own = guild.emojis.cache.find(e => e.name === BOOST_CONFIG.emojiName);
    if (own) return own.toString();

    const appEmojis = await guild.client.application?.emojis.fetch().catch(() => null);
    return appEmojis?.find(e => e.name === BOOST_CONFIG.emojiName)?.toString() ?? "";
}

export async function thankBooster(guild: Guild, memberId: string): Promise<void> {
    const key = `${guild.id}:${memberId}`;
    const now = Date.now();
    if ((recentlyThanked.get(key) ?? 0) > now - BOOST_CONFIG.dedupeWindowMs) return;
    recentlyThanked.set(key, now);

    for (const [k, at] of recentlyThanked) if (at <= now - BOOST_CONFIG.dedupeWindowMs) recentlyThanked.delete(k);

    const channelId = await ServerConfigRepository.getBoostChannel(guild.id);
    if (!channelId || !(await isFeatureEnabled(guild.id, "boost"))) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isSendable()) return;

    await channel.send({ content: boostThanksMessage(memberId, await resolveEmoji(guild)), allowedMentions: { users: [memberId] } });
}
