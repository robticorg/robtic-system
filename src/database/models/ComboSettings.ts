import { Schema, model, type Document } from "mongoose";

export interface IComboSettings extends Document {
    guildId: string;
    championRoleId: string | null;
    /** Per-guild override for COMBO_CONFIG.minScorePerMessage/maxScorePerMessage — null means "use the default". */
    minScorePerMessage: number | null;
    maxScorePerMessage: number | null;
    createdAt: Date;
    updatedAt: Date;
}

const comboSettingsSchema = new Schema<IComboSettings>(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        championRoleId: { type: String, default: null },
        minScorePerMessage: { type: Number, default: null },
        maxScorePerMessage: { type: Number, default: null },
    },
    { timestamps: true }
);

export const ComboSettings = model<IComboSettings>("ComboSettings", comboSettingsSchema);
