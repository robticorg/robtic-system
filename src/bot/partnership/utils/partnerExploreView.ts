import {
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    type BaseMessageOptions,
} from "discord.js";
import type { IPartner } from "@database/models/Partner";
import { Colors } from "@core/config";

export function buildPartnerListMessage(partners: IPartner[]): BaseMessageOptions {
    const embed = new EmbedBuilder()
        .setTitle("🤝 Robtic Partners")
        .setDescription(
            partners.length > 0
                ? "Explore the communities we've partnered with. Pick one below to learn more."
                : "There are no partner servers listed yet."
        )
        .setColor(Colors.info);

    if (partners.length === 0) {
        return { embeds: [embed], components: [] };
    }

    const select = new StringSelectMenuBuilder()
        .setCustomId("partner_explore_select")
        .setPlaceholder("Select a partner to explore")
        .addOptions(
            partners.slice(0, 25).map((p) => ({
                label: p.partnerServerName.slice(0, 100),
                value: p.partnerServerId,
                description: p.description.slice(0, 100),
            }))
        );

    return {
        embeds: [embed],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    };
}

export function buildPartnerDetailMessage(partner: IPartner): BaseMessageOptions {
    const embed = new EmbedBuilder()
        .setTitle(`🤝 ${partner.partnerServerName}`)
        .setDescription(partner.description)
        .setColor(Colors.info);

    const row = new ActionRowBuilder<ButtonBuilder>();

    if (partner.inviteLink) {
        row.addComponents(
            new ButtonBuilder().setLabel("Join Server").setStyle(ButtonStyle.Link).setURL(partner.inviteLink)
        );
    }

    row.addComponents(
        new ButtonBuilder().setCustomId("partner_explore_back").setLabel("⬅ Back to list").setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [embed],
        components: [row],
    };
}
