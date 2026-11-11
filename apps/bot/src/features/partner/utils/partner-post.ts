import {
    ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, DiscordAPIError, EmbedBuilder, MediaGalleryBuilder, MessageFlags,
    RESTJSONErrorCodes, TextDisplayBuilder, type Guild,
} from "discord.js";
import { getLineImage, isBrandedGuild } from "@core/assets";
import { ServerConfigRepository } from "@database/repositories";
import { renderCard, type CardLayoutDoc } from "@bot/utils/render-card";
import type { IPartnerServer } from "@database/models";
import { PartnerServerRepository } from "@database/repositories";
import { Logger } from "@logger";
import { resolvePartnerChannel } from "./partner-channel";
import { renderPartnerBanner } from "./render-partner-banner";
import { buildPartnerPost } from "./partner-views";

export type PartnerPostSync = "edited" | "posted" | "failed";

const DEFAULT_PARTNER_TEXT = "## [name]\n[description]\n[invite]";

/** Fills the server's partner text: [name], [invite], [description], [representative], [server]. */
export function fillPartnerText(text: string, partner: IPartnerServer, server: string): string {
    return text
        .replaceAll("[name]", partner.name)
        .replaceAll("[invite]", partner.inviteUrl)
        .replaceAll("[description]", partner.description)
        .replaceAll("[representative]", `<@${partner.representativeId}>`)
        .replaceAll("[server]", server)
        .slice(0, 3800);
}

/**
 * The post for a partner, in the server's chosen format (dashboard → Partners): Components (text and a Join button),
 * an embed, plain text, or its card image. Robtic's own servers keep the Robtic banner until they choose.
 */
export async function renderPartnerPost(partner: IPartnerServer, serverName = "") {
    const config = (await ServerConfigRepository.find(partner.guildId))?.partnerMessage ?? null;
    if (!config && isBrandedGuild(partner.guildId)) {
        const banner = await renderPartnerBanner(partner.image);
        return { ...buildPartnerPost(String(partner._id), partner.name, banner), flags: MessageFlags.IsComponentsV2 as const, allowedMentions: { parse: [] } };
    }

    const format = config?.format ?? "components";
    const text = fillPartnerText(config?.text?.trim() || DEFAULT_PARTNER_TEXT, partner, serverName);
    const line = config?.withLine ? await getLineImage(partner.guildId).catch(() => null) : null;
    const files: AttachmentBuilder[] = line ? [new AttachmentBuilder(line.data, { name: line.name })] : [];
    const lineGallery = line ? new MediaGalleryBuilder().addItems(item => item.setURL(`attachment://${line.name}`)) : null;
    const join = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(partner.inviteUrl).setLabel(`Join ${partner.name}`.slice(0, 80)),
    );

    if (format === "embed") {
        const embed = new EmbedBuilder().setTitle(partner.name.slice(0, 256)).setDescription(text.slice(0, 4096)).setURL(partner.inviteUrl);
        if (line) embed.setImage(`attachment://${line.name}`);
        return { embeds: [embed], components: [join], files, allowedMentions: { parse: [] as never[] } };
    }
    if (format === "text") {
        return { content: text.slice(0, 2000), files, allowedMentions: { parse: [] as never[] } };
    }

    const components: (TextDisplayBuilder | MediaGalleryBuilder | ActionRowBuilder<ButtonBuilder>)[] = [new TextDisplayBuilder().setContent(text)];
    if (format === "image") {
        const card = await renderCard(config?.card as CardLayoutDoc | undefined, { pictures: { icon: partner.image ?? null }, texts: { name: partner.name } });
        if (card) {
            files.push(new AttachmentBuilder(card, { name: "partner-card.png" }));
            components.push(new MediaGalleryBuilder().addItems(item => item.setURL("attachment://partner-card.png")));
        }
    }
    components.push(join);
    if (lineGallery) components.push(lineGallery);
    return { components, files, flags: MessageFlags.IsComponentsV2 as const, allowedMentions: { parse: [] as never[] } };
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
        const payload = await renderPartnerPost(partner, guild.name);

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
