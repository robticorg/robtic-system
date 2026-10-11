import { DiscordAPIError, RESTJSONErrorCodes, type Guild } from "discord.js";
import type { IInfoPanel } from "@database/models";
import { InfoPanelRepository } from "@database/repositories";
import { Logger } from "@logger";
import { buildInfoPanelMessage } from "./info-render";

export type InfoPostSync = { ok: true; how: "edited" | "posted" } | { ok: false; problem: string };

const GONE = new Set<number>([RESTJSONErrorCodes.UnknownMessage, RESTJSONErrorCodes.UnknownChannel]);

async function fetchTextChannel(guild: Guild, channelId: string) {
    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    return channel?.isTextBased() ? channel : null;
}

/**
 * Brings a panel's message in line with its stored data. Edits it in place when it is still in the
 * panel's channel; posts a new one when the panel moved channel (deleting the old) or the old one is
 * gone. Discord's own refusal (a bad emoji, missing permissions) comes back as the problem.
 */
export async function syncInfoPanel(guild: Guild, panel: IInfoPanel, previousChannelId = panel.channelId): Promise<InfoPostSync> {
    const payload = buildInfoPanelMessage(panel);
    try {
        const moved = previousChannelId !== panel.channelId;
        if (panel.messageId && !moved) {
            const current = await fetchTextChannel(guild, panel.channelId);
            try {
                if (current) {
                    await current.messages.edit(panel.messageId, { ...payload, attachments: [] });
                    return { ok: true, how: "edited" };
                }
            } catch (err) {
                if (!(err instanceof DiscordAPIError && GONE.has(err.code as number))) throw err;
            }
        }

        const channel = await fetchTextChannel(guild, panel.channelId);
        if (!channel) return { ok: false, problem: `I can't post in <#${panel.channelId}> — it's gone or not a text channel.` };

        const message = await channel.send(payload);
        await InfoPanelRepository.setPost(String(panel._id), message.channelId, message.id);

        // Moved: the new message is up, so the old one can go.
        if (moved && panel.messageId) {
            const old = await fetchTextChannel(guild, previousChannelId);
            await old?.messages.delete(panel.messageId).catch(() => null);
        }
        return { ok: true, how: "posted" };
    } catch (err) {
        Logger.warn(`Info panel ${String(panel._id)} could not be posted: ${err}`, "info");
        return { ok: false, problem: `Discord refused the panel: ${(err as Error).message}` };
    }
}
