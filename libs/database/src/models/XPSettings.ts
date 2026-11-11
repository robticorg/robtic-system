import { Schema, model, type Document } from "mongoose";

export interface LevelCardLayoutDoc {
    background: string | null;
    width: number;
    height: number;
    avatar: { x: number; y: number; r: number };
    name: { x: number; y: number; size: number; color: string };
    kind: { x: number; y: number; size: number; color: string };
    level: { x: number; y: number; size: number; color: string };
}

export interface IXPSettings extends Document {
    guildId: string;
    /** Channels where neither chat XP nor the real-message counter is read at all. */
    excludedChannels: string[];
    supportChannels: string[];
    staffChannels: string[];
    allowedRoles: string[];
    decayEnabled: boolean;
    /** Where "reached level N" is posted. Unset means level-ups are not announced publicly. */
    levelUpChannelId?: string;
    /**
     * How the level-up is announced (dashboard → Levels & XP). Unset = Robtic's card with a mention, as before.
     * `card` positions are in the background's own pixels; a null background is the built-in images/level.png.
     */
    levelUpMessage?: {
        mode: "image" | "text";
        text: string;
        card?: LevelCardLayoutDoc;
    } | null;
    createdAt: Date;
    updatedAt: Date;
}

const xpSettingsSchema = new Schema<IXPSettings>(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        excludedChannels: [{ type: String }],
        supportChannels: [{ type: String }],
        staffChannels: [{ type: String }],
        allowedRoles: [{ type: String }],
        decayEnabled: { type: Boolean, default: true },
        levelUpChannelId: { type: String },
        levelUpMessage: { type: Schema.Types.Mixed, default: null },
    },
    { timestamps: true }
);

export const XPSettings = model<IXPSettings>("XPSettings", xpSettingsSchema);
