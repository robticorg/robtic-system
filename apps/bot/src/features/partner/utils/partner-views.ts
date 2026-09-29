import {
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    MediaGalleryBuilder,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
} from "discord.js";
import { PARTNER_CONFIG } from "@constants";
import type { IPartnerServer } from "@database/models";

/**
 * Every Components V2 layout the partner feature sends. Sent with `MessageFlags.IsComponentsV2`,
 * so there is no `content` or `embeds`.
 *
 * Deliberately no ContainerBuilder: a container draws the embed-style card around the message.
 * These are top-level sections instead — text with its button beside it — so the post reads as
 * plain message content.
 */

export const PARTNER_INFO_ID = /^partner:info:[a-f0-9]{24}$/;

const BANNER_NAME = "partner.png";
const LOGO_NAME = "partner-logo.png";

const text = (content: string) => new TextDisplayBuilder().setContent(content);

/**
 * The public post: the banner full width, then two sections — the partner's name beside
 * Information (ours), and the call to action beside Be a Partner (a link, always grey).
 */
export function buildPartnerPost(partnerId: string, serverName: string, banner: Buffer) {
    const gallery = new MediaGalleryBuilder().addItems(item =>
        item.setURL(`attachment://${BANNER_NAME}`).setDescription(`Robtic × ${serverName}`.slice(0, 1024)));

    const info = new SectionBuilder()
        .addTextDisplayComponents(text(`### Robtic × ${serverName}`))
        .setButtonAccessory(new ButtonBuilder()
            .setCustomId(`partner:info:${partnerId}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(PARTNER_CONFIG.emojis.info)
            .setLabel("| Information"));

    const join = new SectionBuilder()
        .addTextDisplayComponents(text("-# Want your server here too?"))
        .setButtonAccessory(new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(PARTNER_CONFIG.beAPartnerUrl)
            .setEmoji(PARTNER_CONFIG.emojis.robtic)
            .setLabel("| Be a Partner"));

    return { components: [gallery, info, join], files: [new AttachmentBuilder(banner, { name: BANNER_NAME })] };
}

/** The Information panel: who they are beside their logo, then their representative beside a way in. */
export function buildPartnerInfo(partner: IPartnerServer) {
    const about = new SectionBuilder()
        .addTextDisplayComponents(text(`## ${partner.name}\n${partner.description}`))
        .setThumbnailAccessory(thumb => thumb.setURL(`attachment://${LOGO_NAME}`));

    const contact = new SectionBuilder()
        .addTextDisplayComponents(text(`**Representative:** <@${partner.representativeId}>\n**Invite:** ${partner.inviteUrl}`))
        .setButtonAccessory(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(partner.inviteUrl).setLabel("Join Server"));

    return {
        components: [about, new SeparatorBuilder(), contact],
        files: [new AttachmentBuilder(partner.image, { name: LOGO_NAME })],
    };
}

/** Components V2 caps a message's text at 4000 characters in total. */
const LIST_TEXT_BUDGET = 3800;

export function buildPartnerList(guildName: string, partners: IPartnerServer[]) {
    const header = `## ${guildName} partners (${partners.length})`;
    const lines: string[] = [];
    let used = header.length;

    for (const [i, p] of partners.entries()) {
        const post = p.channelId && p.messageId ? ` · [post](https://discord.com/channels/${p.guildId}/${p.channelId}/${p.messageId})` : "";
        const line = `**${i + 1}.** ${p.name} · <@${p.representativeId}> · ${p.inviteUrl}${post}`;
        if (used + line.length + 40 > LIST_TEXT_BUDGET) {
            lines.push(`…and ${partners.length - i} more.`);
            break;
        }
        lines.push(line);
        used += line.length + 1;
    }

    return {
        components: [
            text(header),
            new SeparatorBuilder(),
            text(lines.length ? lines.join("\n") : "No partners yet. Add one with `/partner add`."),
        ],
    };
}
