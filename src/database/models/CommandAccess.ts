import { Schema, model, type Document } from "mongoose";

/** Per-guild, per-command access grant (role or StaffTier category) — an additional way in, on top of the command's normal permission check. */
export interface ICommandAccess extends Document {
    guildId: string;
    commandName: string;
    allowedRoleIds: string[];
    allowedCategoryKeys: string[];
    createdAt: Date;
    updatedAt: Date;
}

const commandAccessSchema = new Schema<ICommandAccess>(
    {
        guildId: { type: String, required: true, index: true },
        commandName: { type: String, required: true },
        allowedRoleIds: { type: [String], default: [] },
        allowedCategoryKeys: { type: [String], default: [] },
    },
    { timestamps: true }
);

commandAccessSchema.index({ guildId: 1, commandName: 1 }, { unique: true });

export const CommandAccess = model<ICommandAccess>("CommandAccess", commandAccessSchema);
