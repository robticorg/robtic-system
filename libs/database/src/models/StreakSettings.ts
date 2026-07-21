import { Schema, model, type Document } from "mongoose";

export interface IStreakSettings extends Document {
    guildId: string;
    channels: string[];
    remindersEnabled: boolean;
    minMessageLength: number;
    createdAt: Date;
    updatedAt: Date;
}

const streakSettingsSchema = new Schema<IStreakSettings>(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        channels: [{ type: String }],
        remindersEnabled: { type: Boolean, default: true },
        minMessageLength: { type: Number, default: 5 },
    },
    { timestamps: true }
);

export const StreakSettings = model<IStreakSettings>("StreakSettings", streakSettingsSchema);
