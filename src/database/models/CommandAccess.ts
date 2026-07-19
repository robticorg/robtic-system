import { Schema, model, type Document } from "mongoose";

/**
 * Per-guild, per-command access grant — lets an admin allow a specific role or StaffTier
 * category (by key) to use a command, independent of that command's hardcoded
 * requiredPermission/department score check. This is an *additional* way in: a member
 * granted here bypasses the normal check, but the normal check still works for everyone else.
 */
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
