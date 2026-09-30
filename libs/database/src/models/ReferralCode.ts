import { Schema, model, type Document } from "mongoose";

/**
 * One referral code in one guild, created by staff with `/referral-config create`.
 *
 * The code's own row is the single source of truth for its bonus: `bonusBp` and `active` are read
 * at claim time by every member linked to it (`ReferralCodeUse`), so editing or deactivating a code
 * takes effect on everyone's next claim with nothing stored per member. `bonusBp` is clamped again
 * when read (`referralBonusBp`), so even a hand-edited row cannot exceed `REWARD_REFERRAL_BONUS.maxBp`.
 *
 * `code` is stored lowercase; the unique index on `{guildId, code}` keeps codes unique per guild.
 * `ownerId` is the partner/creator the code belongs to — they cannot use their own code.
 */
export interface IReferralCode extends Document {
    guildId: string;
    code: string;
    ownerId: string;
    bonusBp: number;
    active: boolean;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const referralCodeSchema = new Schema<IReferralCode>(
    {
        guildId: { type: String, required: true },
        code: { type: String, required: true },
        ownerId: { type: String, required: true },
        bonusBp: { type: Number, required: true, min: 0 },
        active: { type: Boolean, required: true, default: true },
        createdBy: { type: String, required: true },
    },
    { timestamps: true }
);

referralCodeSchema.index({ guildId: 1, code: 1 }, { unique: true });

export const ReferralCode = model<IReferralCode>("ReferralCode", referralCodeSchema);
