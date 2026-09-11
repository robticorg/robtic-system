import { Schema, model, type Document } from "mongoose";

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
    },
    { timestamps: true }
);

export const XPSettings = model<IXPSettings>("XPSettings", xpSettingsSchema);
