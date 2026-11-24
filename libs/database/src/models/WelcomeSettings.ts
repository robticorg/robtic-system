import { Schema, model, type Document } from "mongoose";

/** A line of the server's own text on the welcome card. */
export interface WelcomeCardTextDoc { id: string; text: string; x: number; y: number; size: number; color: string }

/**
 * The welcome (or goodbye) card from the dashboard: an uploaded image or a plain colour, the member's picture and
 * name, and the server's own lines. Positions are in the card's own pixels (`width` × `height`).
 */
export interface WelcomeCardDoc {
    background: string | null;
    fill: string | null;
    width: number;
    height: number;
    avatar: { x: number; y: number; r: number };
    name: { x: number; y: number; size: number; color: string };
    texts: WelcomeCardTextDoc[];
}

/** One of the two messages (dashboard → Welcome). Written by robtic-discord (libs/server/src/real/system.ts). */
export interface WelcomeMessageDoc {
    enabled: boolean;
    channelId: string | null;
    /** Join only: "channel", "dm" or "both". */
    send: "channel" | "dm" | "both";
    mode: "image" | "text" | "embed" | "components";
    text: string;
    /** The embed or Components message from the dashboard's builder (mode embed / components). */
    design: Record<string, unknown> | null;
    /** Embed / Components: the card goes in as the message's picture. */
    withCard: boolean;
    card: WelcomeCardDoc;
}

export interface IWelcomeSettings extends Document {
    guildId: string;
    join?: WelcomeMessageDoc | null;
    leave?: WelcomeMessageDoc | null;
    createdAt: Date;
    updatedAt: Date;
}

const welcomeSettingsSchema = new Schema<IWelcomeSettings>(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        join: { type: Schema.Types.Mixed, default: null },
        leave: { type: Schema.Types.Mixed, default: null },
    },
    { timestamps: true, collection: "welcomesettings" }
);

export const WelcomeSettings = model<IWelcomeSettings>("WelcomeSettings", welcomeSettingsSchema);
