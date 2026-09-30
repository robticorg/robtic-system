import { DiscordAPIError, MessageFlags, RESTJSONErrorCodes, type Guild } from "discord.js";
import type { IPartnerServer } from "@database/models";
import { PartnerServerRepository } from "@database/repositories";
import { Logger } from "@logger";
import { resolvePartnerChannel } from "./partner-channel";
import { renderPartnerBanner } from "./render-partner-banner";
import { buildPartnerPost } from "./partner-views";

export type PartnerPostSync = "edited" | "posted" | "failed";

/** The post exactly as the current code would send it — banner re-rendered from the stored image. */
export async function renderPartnerPost(partner: IPartnerServer) {
    const banner = await renderPartnerBanner(partner.image);
    return {
        ...buildPartnerPost(String(partner._id), partner.name, banner),
        flags: MessageFlags.IsComponentsV2 as const,
        allowedMentions: { parse: [] },
    };
}

const GONE = new Set<number>([RESTJSONErrorCodes.UnknownMessage, RESTJSONErrorCodes.UnknownChannel]);

/**
 * Brings a partner's post in line with its stored data and the current layout. Edits the post in
 * place (its old banner attachment replaced); if the post or its channel is gone, posts a new one
 * in the partner channel and remembers it. Any other failure is reported, never reposted, so a
 * permissions problem can't leave duplicates behind.
 */
export async function syncPartnerPost(guild: Guild, partner: IPartnerServer): Promise<PartnerPostSync> {
    try {
        const payload = await renderPartnerPost(partner);

        if (partner.channelId && partner.messageId) {
            const channel = guild.channels.cache.get(partner.channelId) ?? await guild.channels.fetch(partner.channelId).catch(() => null);
            if (channel?.isTextBased()) {
                try {
                    await channel.messages.edit(partner.messageId, { ...payload, attachments: [] });
                    return "edited";
                } catch (err) {
                    if (!(err instanceof DiscordAPIError && GONE.has(err.code as number))) throw err;
                }
            }
        }

        const resolved = await resolvePartnerChannel(guild);
        if ("problem" in resolved) return "failed";

        const message = await resolved.channel.send(payload);
        await PartnerServerRepository.setPost(String(partner._id), message.channelId, message.id);
        return "posted";
    } catch (err) {
        Logger.warn(`Partner post for ${partner.name} (${String(partner._id)}) could not be updated: ${err}`, "partner");
        return "failed";
    }
}
