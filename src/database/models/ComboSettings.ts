import { Schema, model, type Document } from "mongoose";

export interface IComboSettings extends Document {
    guildId: string;
    championRoleId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const comboSettingsSchema = new Schema<IComboSettings>(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        championRoleId: { type: String, default: null },
    },
    { timestamps: true }
);

export const ComboSettings = model<IComboSettings>("ComboSettings", comboSettingsSchema);
