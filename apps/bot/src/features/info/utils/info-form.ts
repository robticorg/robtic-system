import {
    ChannelSelectMenuBuilder,
    ChannelType,
    CheckboxBuilder,
    FileUploadBuilder,
    LabelBuilder,
    ModalBuilder,
    RadioGroupBuilder,
    RadioGroupOptionBuilder,
    TextInputBuilder,
    TextInputStyle,
    parseEmoji,
    type ModalSubmitInteraction,
} from "discord.js";
import { randomUUID } from "node:crypto";
import { INFO_BUTTON_STYLES, INFO_PANEL_TYPES, type IInfoOption, type IInfoPanel, type InfoButtonStyle, type InfoPanelType } from "@database/models";
import { Logger } from "@logger";

/**
 * The info panel form (`/info create`, and prefilled for `/info update`) and the choice form
 * (`/option add`).
 */

export const INFO_CREATE_MODAL_ID = "info:create";
export const INFO_UPDATE_MODAL_ID = /^info:update:[a-f0-9]{24}$/;
export const INFO_OPTION_MODAL_ID = /^info:option:[a-f0-9]{24}$/;

const F = {
    channel: "info-channel",
    description: "info-description",
    type: "info-type",
    image: "info-image",
    removeImage: "info-remove-image",
    label: "info-option-label",
    reply: "info-option-reply",
    menuDescription: "info-option-menu-description",
    emoji: "info-option-emoji",
    style: "info-option-style",
} as const;

const TYPE_LABEL: Record<InfoPanelType, string> = { buttons: "Buttons", menu: "Menu" };
const STYLE_LABEL: Record<InfoButtonStyle, string> = { primary: "Blue", secondary: "Grey", success: "Green", danger: "Red" };

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };

function radio<T extends string>(id: string, values: readonly T[], labels: Record<T, string>, selected: T): RadioGroupBuilder {
    return new RadioGroupBuilder()
        .setCustomId(id)
        .setRequired(true)
        .addOptions(values.map(v => new RadioGroupOptionBuilder().setLabel(labels[v]).setValue(v).setDefault(v === selected)));
}

/** The create form, or — given a panel — the update form with its current values filled in. */
export function buildInfoPanelModal(panel?: IInfoPanel): ModalBuilder {
    const channel = new ChannelSelectMenuBuilder()
        .setCustomId(F.channel)
        .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setMinValues(1)
        .setMaxValues(1)
        .setRequired(true);
    if (panel) channel.setDefaultChannels(panel.channelId);

    const description = new TextInputBuilder()
        .setCustomId(F.description)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(4000);
    if (panel) description.setValue(panel.description);

    const modal = new ModalBuilder()
        .setCustomId(panel ? `info:update:${String(panel._id)}` : INFO_CREATE_MODAL_ID)
        .setTitle(panel ? "Update Info Panel" : "Create Info Panel")
        .addLabelComponents(
            new LabelBuilder().setLabel("Channel").setDescription("Where the panel is posted").setChannelSelectMenuComponent(channel),
            new LabelBuilder().setLabel("Description").setDescription("The panel's text — markdown works").setTextInputComponent(description),
            new LabelBuilder()
                .setLabel("Type")
                .setDescription("How members pick a choice")
                .setRadioGroupComponent(radio(F.type, INFO_PANEL_TYPES, TYPE_LABEL, panel?.type ?? "buttons")),
            new LabelBuilder()
                .setLabel(panel?.image ? "New image (optional)" : "Image (optional)")
                .setDescription(panel?.image ? "Leave empty to keep the current one. PNG, JPG, GIF or WEBP, 8 MB max." : "Shown above the text. PNG, JPG, GIF or WEBP, 8 MB max.")
                .setFileUploadComponent(new FileUploadBuilder().setCustomId(F.image).setRequired(false).setMinValues(0).setMaxValues(1)),
        );

    if (panel?.image) {
        modal.addLabelComponents(
            new LabelBuilder()
                .setLabel("Remove the current image")
                .setCheckboxComponent(new CheckboxBuilder().setCustomId(F.removeImage).setDefault(false)),
        );
    }
    return modal;
}

export interface InfoPanelFormValues {
    channelId: string;
    description: string;
    type: InfoPanelType;
    /** A new image, `null` to remove it, or `undefined` to leave it as it is. */
    image?: { data: Buffer; name: string } | null;
}

export async function readInfoPanelForm(interaction: ModalSubmitInteraction): Promise<{ values: InfoPanelFormValues } | { problem: string }> {
    const channel = interaction.fields.getSelectedChannels(F.channel, true).first();
    if (!channel) return { problem: "Pick a channel." };

    const description = interaction.fields.getTextInputValue(F.description).trim();
    if (!description) return { problem: "The description can't be empty." };

    const typeValue = interaction.fields.getRadioGroup(F.type) ?? "buttons";
    const type: InfoPanelType = (INFO_PANEL_TYPES as readonly string[]).includes(typeValue) ? typeValue as InfoPanelType : "buttons";

    const values: InfoPanelFormValues = { channelId: channel.id, description, type };

    const upload = interaction.fields.getUploadedFiles(F.image)?.first();
    if (upload) {
        const ext = IMAGE_EXT[upload.contentType?.split(";")[0]?.trim() ?? ""];
        if (!ext) return { problem: "The image must be a PNG, JPG, GIF or WEBP file." };
        if (upload.size > IMAGE_MAX_BYTES) return { problem: "That image is too large — 8 MB at most." };
        try {
            const response = await fetch(upload.url);
            if (!response.ok) throw new Error(`download failed (${response.status})`);
            values.image = { data: Buffer.from(await response.arrayBuffer()), name: `info-image.${ext}` };
        } catch (err) {
            Logger.warn(`Info panel image could not be downloaded: ${err}`, "info");
            return { problem: "I couldn't read that image — try uploading it again." };
        }
    } else if (hasField(interaction, F.removeImage) && interaction.fields.getCheckbox(F.removeImage)) {
        values.image = null;
    }

    return { values };
}

function hasField(interaction: ModalSubmitInteraction, customId: string): boolean {
    try {
        interaction.fields.getField(customId);
        return true;
    } catch {
        return false;
    }
}

/** The `/option add` form. The menu line and the colour each apply to one panel type only — both are always asked, so switching type later keeps them. */
export function buildInfoOptionModal(panel: IInfoPanel): ModalBuilder {
    return new ModalBuilder()
        .setCustomId(`info:option:${String(panel._id)}`)
        .setTitle("Add Option")
        .addLabelComponents(
            new LabelBuilder()
                .setLabel("Title")
                .setDescription("Shown on the button, or as the menu entry")
                .setTextInputComponent(new TextInputBuilder().setCustomId(F.label).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80)),
            new LabelBuilder()
                .setLabel("Answer")
                .setDescription("What a member sees (only them) when they pick it")
                .setTextInputComponent(new TextInputBuilder().setCustomId(F.reply).setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000)),
            new LabelBuilder()
                .setLabel("Menu description (optional)")
                .setDescription("The small line under the entry — menu panels only")
                .setTextInputComponent(new TextInputBuilder().setCustomId(F.menuDescription).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(100)),
            new LabelBuilder()
                .setLabel("Emoji (optional)")
                .setDescription("A normal emoji like 📌, or a server emoji like <:name:123…>")
                .setTextInputComponent(new TextInputBuilder().setCustomId(F.emoji).setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(64)),
            new LabelBuilder()
                .setLabel("Button colour")
                .setDescription("Button panels only")
                .setRadioGroupComponent(radio(F.style, INFO_BUTTON_STYLES, STYLE_LABEL, "primary")),
        );
}

const CUSTOM_EMOJI = /^<a?:\w{2,32}:\d{15,25}>$/;
const UNICODE_EMOJI = /^(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]️?⃣)/u;

/** A unicode emoji or `<:name:id>`, or `null` when it is neither. */
export function normalizeEmoji(input: string): string | null {
    const value = input.trim();
    if (CUSTOM_EMOJI.test(value)) return parseEmoji(value) ? value : null;
    return UNICODE_EMOJI.test(value) && value.length <= 16 && !/\s/.test(value) ? value : null;
}

export function readInfoOptionForm(interaction: ModalSubmitInteraction): { option: IInfoOption } | { problem: string } {
    const label = interaction.fields.getTextInputValue(F.label).trim();
    const reply = interaction.fields.getTextInputValue(F.reply).trim();
    const menuDescription = interaction.fields.getTextInputValue(F.menuDescription).trim() || null;
    const emojiInput = interaction.fields.getTextInputValue(F.emoji).trim();
    const styleValue = interaction.fields.getRadioGroup(F.style) ?? "primary";

    if (!label) return { problem: "The title can't be empty." };
    if (!reply) return { problem: "The answer can't be empty." };

    const emoji = emojiInput ? normalizeEmoji(emojiInput) : null;
    if (emojiInput && !emoji) return { problem: "That emoji isn't valid — use one emoji like 📌, or a server emoji like `<:name:123456789012345678>`." };

    const style: InfoButtonStyle = (INFO_BUTTON_STYLES as readonly string[]).includes(styleValue) ? styleValue as InfoButtonStyle : "primary";

    return { option: { optionId: randomUUID().replaceAll("-", "").slice(0, 8), label, reply, menuDescription, emoji, style } };
}
