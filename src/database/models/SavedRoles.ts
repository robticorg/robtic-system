import { Schema, model, type Document } from "mongoose";

export interface ISavedRoles extends Document {
    guildId: string;
    userId: string;
    /** Legacy flat snapshot from before the staff/other split — only populated on docs written pre-migration. */
    roles: string[];
    /** Roles that were bound to a StaffTier at the time this member left (only ever non-empty when wasStaff is true). Restored only within the short staff-role window. */
    staffRoles: string[];
    /** Every other saved role. Restored within the (longer) member-role window. */
    otherRoles: string[];
    /** Whether this member had a StaffMember record at the time they left — gates the staffRoles/short-window split. */
    wasStaff: boolean;
    leftAt: Date;
}

const savedRolesSchema = new Schema<ISavedRoles>(
    {
        guildId: { type: String, required: true },
        userId: { type: String, required: true },
        roles: { type: [String], default: [] },
        staffRoles: { type: [String], default: [] },
        otherRoles: { type: [String], default: [] },
        wasStaff: { type: Boolean, default: false },
        leftAt: { type: Date, required: true },
    },
    { timestamps: true }
);

savedRolesSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const SavedRoles = model<ISavedRoles>("SavedRoles", savedRolesSchema);
