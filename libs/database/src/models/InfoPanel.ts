import { Schema, model, type Document } from "mongoose";

export const INFO_PANEL_TYPES = ["buttons", "menu"] as const;
export type InfoPanelType = typeof INFO_PANEL_TYPES[number];

export const INFO_BUTTON_STYLES = ["primary", "secondary", "success", "danger"] as const;
export type InfoButtonStyle = typeof INFO_BUTTON_STYLES[number];

/** One choice on an info panel: a button, or an entry in its menu. */
export interface IInfoOption {
    /** Short random id, used in the button's customId or as the menu value. */
    optionId: string;
    /** Shown on the button, or as the menu entry's title. */
    label: string;
    /** What the member sees (only them) after picking it. */
    reply: string;
    /** The line under the entry in a menu; unused on buttons. */
    menuDescription: string | null;
    /** A unicode emoji or a custom one (`<:name:id>`). */
    emoji: string | null;
    /** Button colour; unused in a menu. */
    style: InfoButtonStyle;
}

/**
 * A panel built with `/info create` and filled with `/option add`: a message whose buttons (or menu)
 * each show their own answer to whoever picks them.
 *
 * The image is kept here, not as a link: an uploaded attachment's URL expires, and the panel is
 * re-posted with it each time it changes.
 */
export interface IInfoPanel extends Document {
    guildId: string;
    channelId: string;
    messageId: string | null;
    description: string;
    type: InfoPanelType;
    image: Buffer | null;
    /** File name the image is posted under — its extension keeps GIFs animated. */
    imageName: string | null;
    options: IInfoOption[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const optionSchema = new Schema<IInfoOption>(
    {
        optionId: { type: String, required: true },
        label: { type: String, required: true },
        reply: { type: String, required: true },
        menuDescription: { type: String, default: null },
        emoji: { type: String, default: null },
        style: { type: String, enum: INFO_BUTTON_STYLES, default: "secondary" },
    },
    { _id: false }
);

const infoPanelSchema = new Schema<IInfoPanel>(
    {
        guildId: { type: String, required: true, index: true },
        channelId: { type: String, required: true },
        messageId: { type: String, default: null },
        description: { type: String, required: true },
        type: { type: String, enum: INFO_PANEL_TYPES, required: true },
        image: { type: Buffer, default: null },
        imageName: { type: String, default: null },
        options: { type: [optionSchema], default: [] },
        createdBy: { type: String, required: true },
    },
    { timestamps: true }
);

export const InfoPanel = model<IInfoPanel>("InfoPanel", infoPanelSchema);
