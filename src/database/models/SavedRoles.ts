import { Schema, model, type Document } from "mongoose";

export interface ISavedRoles extends Document {
    guildId: string;
    userId: string;
    roles: string[];
    leftAt: Date;
}

const savedRolesSchema = new Schema<ISavedRoles>(
    {
        guildId: { type: String, required: true },
        userId: { type: String, required: true },
        roles: { type: [String], default: [] },
        leftAt: { type: Date, required: true },
    },
    { timestamps: true }
);

savedRolesSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const SavedRoles = model<ISavedRoles>("SavedRoles", savedRolesSchema);
