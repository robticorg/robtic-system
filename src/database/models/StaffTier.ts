import { Schema, model, type Document } from "mongoose";

/**
 * One per-guild staff tier — replaces the old global ROLE_MAP/PERMISSION_HIERARCHY/
 * LEAD_MANAGER_MAP/MANAGER_DEPARTMENT_MAP/DEPARTMENT_ROLES (see src/core/config/constants.ts,
 * now retired) since a single hardcoded tier/department set can't fit every server this bot runs on.
 * A guild's "departments" are just whatever distinct `department` values appear across its tiers —
 * there's no separate department collection, and no fixed set of tiers either.
 */
export interface IStaffTier extends Document {
    guildId: string;
    key: string;
    name: string;
    score: number;
    department: string | null;
    roleIds: string[];
    createdAt: Date;
    updatedAt: Date;
}

const staffTierSchema = new Schema<IStaffTier>(
    {
        guildId: { type: String, required: true, index: true },
        key: { type: String, required: true },
        name: { type: String, required: true },
        score: { type: Number, required: true, default: 0 },
        department: { type: String, default: null },
        roleIds: { type: [String], default: [] },
    },
    { timestamps: true }
);

staffTierSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const StaffTier = model<IStaffTier>("StaffTier", staffTierSchema);
