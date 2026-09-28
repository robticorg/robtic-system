import { Schema, model, type Document } from "mongoose";

/**
 * One credited invite relationship: `inviterId` invited `inviteeId` into `guildId`, and that
 * credit is good for `REWARD_INVITE_BONUS.inviteDurationDays` from the moment they joined.
 *
 * The unique index on `{guildId, inviteeId}` is the entire duplicate-credit guard: a member can be
 * credited to an inviter at most once per guild, ever. If they leave and rejoin — through the same
 * invite or a different one — the insert collides and is treated as "already credited" (see
 * `RewardInviteCreditRepository.credit`), the same E11000-as-idempotency pattern used everywhere
 * else a reward movement must not double-apply. The row is never deleted, on leave or on expiry:
 * removing it would let a rejoin mint a second credit, which is exactly what this guards against.
 *
 * `leftAt` is set while the invitee is out of the guild, so the credit stops occupying a slot; a
 * rejoin clears it, but never moves `expiresAt` — the credit resumes under its original deadline,
 * if any of it is left.
 *
 * Each invite's validity is independent — `expiresAt` is fixed at creation from that row's own
 * `joinedAt`, never reset on a shared clock, so two members invited on different days expire on
 * different days.
 */
export interface IRewardInviteCredit extends Document {
    guildId: string;
    inviterId: string;
    inviteeId: string;
    inviteCode: string;
    joinedAt: Date;
    expiresAt: Date;
    leftAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const rewardInviteCreditSchema = new Schema<IRewardInviteCredit>(
    {
        guildId: { type: String, required: true, index: true },
        inviterId: { type: String, required: true, index: true },
        inviteeId: { type: String, required: true },
        inviteCode: { type: String, required: true },
        joinedAt: { type: Date, required: true },
        expiresAt: { type: Date, required: true },
        leftAt: { type: Date, default: null },
    },
    { timestamps: true }
);

rewardInviteCreditSchema.index({ guildId: 1, inviteeId: 1 }, { unique: true });
rewardInviteCreditSchema.index({ guildId: 1, inviterId: 1, expiresAt: 1 });

export const RewardInviteCredit = model<IRewardInviteCredit>("RewardInviteCredit", rewardInviteCreditSchema);
