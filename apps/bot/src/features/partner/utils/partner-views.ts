import {
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    type ActionRowBuilder,
} from "discord.js";
import { PARTNER_CONFIG } from "@constants";
import type { IPartnerServer } from "@database/models";

/**
 * Every Components V2 layout the partner feature sends. Sent with `MessageFlags.IsComponentsV2`,
 * so there is no `content` or `embeds` — the container is the whole message.
 */

export const PARTNER_INFO_ID = /^partner:info:[a-f0-9]{24}$/;

const BANNER_NAME = "partner.png";
const LOGO_NAME = "partner-logo.png";

/**
 * The public post: the banner full width, then two grey buttons — Information (ours) and
 * Be a Partner (a link, which Discord always renders grey).
 */
export function buildPartnerPost(partnerId: string, serverName: string, banner: Buffer) {
    const container = new ContainerBuilder()
        .addMediaGalleryComponents(gallery => gallery.addItems(item =>
            item.setURL(`attachment://${BANNER_NAME}`).setDescription(`Robtic × ${serverName}`.slice(0, 1024))))
        .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) => row.setComponents(
            new ButtonBuilder()
                .setCustomId(`partner:info:${partnerId}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji(PARTNER_CONFIG.emojis.info)
                .setLabel("| Information"),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setURL(PARTNER_CONFIG.beAPartnerUrl)
                .setEmoji(PARTNER_CONFIG.emojis.robtic)
                .setLabel("| Be a Partner"),
        ));

    return { components: [container], files: [new AttachmentBuilder(banner, { name: BANNER_NAME })] };
}

/** The Information panel: who they are, their representative, and a way in. */
export function buildPartnerInfo(partner: IPartnerServer) {
    const container = new ContainerBuilder()
        .addSectionComponents(section => section
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${partner.name}\n${partner.description}`))
            .setThumbnailAccessory(thumb => thumb.setURL(`attachment://${LOGO_NAME}`)))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `**Representative:** <@${partner.representativeId}>\n**Invite:** ${partner.inviteUrl}`,
        ))
        .addActionRowComponents((row: ActionRowBuilder<ButtonBuilder>) => row.setComponents(
            new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(partner.inviteUrl).setLabel("Join Server"),
        ));

    return { components: [container], files: [new AttachmentBuilder(partner.image, { name: LOGO_NAME })] };
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

    const container = new ContainerBuilder()
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(header))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(lines.length ? lines.join("\n") : "No partners yet. Add one with `/partner add`."));

    return { components: [container] };
}
