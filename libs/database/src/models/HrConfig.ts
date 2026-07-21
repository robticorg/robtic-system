import { Schema, model, type Document } from "mongoose";

/** Per-guild settings for the HR bot's staff-warn system: destination log channel + shortcut-eligible roles. */
export interface IHrConfig extends Document {
    guildId: string;
    staffWarnLogChannelId: string | null;
    staffWarnShortcutRoleIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

const hrConfigSchema = new Schema<IHrConfig>(
    {
        guildId: { type: String, required: true, unique: true },
        staffWarnLogChannelId: { type: String, default: null },
        staffWarnShortcutRoleIds: { type: [String], default: [] },
    },
    { timestamps: true }
);

export const HrConfig = model<IHrConfig>("HrConfig", hrConfigSchema);
