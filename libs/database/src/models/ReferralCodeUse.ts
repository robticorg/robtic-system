import { Schema, model, type Document } from "mongoose";

/**
 * Which referral code a member applied in a guild — the relationship only, never a bonus.
 *
 * The unique index on `{guildId, discordId}` means a member holds at most one code per guild. It
 * points at the code by id, so the bonus is always read from the code's current row: inactive
 * resolves to +0% and back again when reactivated, and a deleted code resolves to +0% (the member
 * may then apply another). Deleting a code never touches these rows.
 */
export interface IReferralCodeUse extends Document {
    guildId: string;
    discordId: string;
    codeId: string;
    appliedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const referralCodeUseSchema = new Schema<IReferralCodeUse>(
    {
        guildId: { type: String, required: true },
        discordId: { type: String, required: true },
        codeId: { type: String, required: true, index: true },
        appliedAt: { type: Date, required: true },
    },
    { timestamps: true }
);

referralCodeUseSchema.index({ guildId: 1, discordId: 1 }, { unique: true });

export const ReferralCodeUse = model<IReferralCodeUse>("ReferralCodeUse", referralCodeUseSchema);
