import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from "discord.js";
import type { IInfoOption, IInfoPanel, InfoButtonStyle } from "@database/models";

export const INFO_BUTTON_ID = /^info:btn:[a-f0-9]{24}:[a-f0-9]{8}$/;
export const INFO_MENU_ID = /^info:menu:[a-f0-9]{24}$/;

/** Discord allows 25 menu entries, and 25 buttons fit in 5 rows of 5. */
export const INFO_MAX_OPTIONS = 25;

const BUTTON_STYLE: Record<InfoButtonStyle, ButtonStyle> = {
    primary: ButtonStyle.Primary,
    secondary: ButtonStyle.Secondary,
    success: ButtonStyle.Success,
    danger: ButtonStyle.Danger,
};

function button(panelId: string, option: IInfoOption): ButtonBuilder {
    const b = new ButtonBuilder()
        .setCustomId(`info:btn:${panelId}:${option.optionId}`)
        .setLabel(option.label)
        .setStyle(BUTTON_STYLE[option.style] ?? ButtonStyle.Secondary);
    if (option.emoji) b.setEmoji(option.emoji);
    return b;
}

function menuEntry(option: IInfoOption): StringSelectMenuOptionBuilder {
    const entry = new StringSelectMenuOptionBuilder().setLabel(option.label).setValue(option.optionId);
    if (option.menuDescription) entry.setDescription(option.menuDescription);
    if (option.emoji) entry.setEmoji(option.emoji);
    return entry;
}

/** The panel's message: image, description, then its buttons or its menu. Always Components V2. */
export function buildInfoPanelMessage(panel: IInfoPanel) {
    const panelId = String(panel._id);
    const container = new ContainerBuilder();
    const files: AttachmentBuilder[] = [];

    if (panel.image && panel.imageName) {
        files.push(new AttachmentBuilder(panel.image, { name: panel.imageName }));
        container.addMediaGalleryComponents(g => g.addItems(i => i.setURL(`attachment://${panel.imageName}`)));
    }

    container.addTextDisplayComponents(t => t.setContent(panel.description));

    const options = panel.options.slice(0, INFO_MAX_OPTIONS);
    if (options.length && panel.type === "buttons") {
        for (let i = 0; i < options.length; i += 5) {
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(options.slice(i, i + 5).map(o => button(panelId, o))),
            );
        }
    } else if (options.length) {
        container.addActionRowComponents(
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(`info:menu:${panelId}`)
                    .setPlaceholder("Choose an option…")
                    .addOptions(options.map(menuEntry)),
            ),
        );
    }

    return {
        components: [container],
        files,
        flags: MessageFlags.IsComponentsV2 as const,
        allowedMentions: { parse: [] },
    };
}

/** What a member sees, only them, after picking a choice. */
export function buildInfoReply(option: IInfoOption) {
    return {
        components: [new ContainerBuilder().addTextDisplayComponents(t => t.setContent(option.reply))],
        flags: (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) as number,
        allowedMentions: { parse: [] },
    };
}
