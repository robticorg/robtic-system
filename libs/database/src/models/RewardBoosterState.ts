import { Schema, model, type Document } from "mongoose";

/**
 * The state needed to compute the Booster reward bonus — nothing else. A row exists only while the
 * member is boosting; it is deleted the moment they stop (see `RewardBoosterStateRepository.clear`).
 *
 * `continuousStartedAt` marks the start of the current unbroken *boosting* period. Whenever Discord
 * tells us, it is Discord's own `GuildMember.premiumSince` — which already means exactly "boosting
 * continuously since" — so a bot restart or a missed event never loses or resets progress. It
 * survives a boost-count change (6 boosts dropping to 1 keeps the same start, just a different
 * required-days lookup).
 *
 * `boostCount` is how many boosts have been *observed* in this period. Discord exposes no per-member
 * boost count to bots, so it is assembled from boost announcements (`+n` each) and lowered by
 * guild-wide reconciliation when the server's total drops — see `libs/core/src/rewards/booster-state.ts`.
 * `0` means "boosting, but no announcement seen yet", which counts as one boost, never zero: an
 * existing row is itself proof of at least one active boost.
 *
 * Deliberately does **not** store a calculated bonus percentage: that is derived fresh, every time,
 * from this state plus the current wall clock.
 */
export interface IRewardBoosterState extends Document {
    guildId: string;
    discordId: string;
    boostCount: number;
    continuousStartedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const rewardBoosterStateSchema = new Schema<IRewardBoosterState>(
    {
        guildId: { type: String, required: true, index: true },
        discordId: { type: String, required: true, index: true },
        boostCount: { type: Number, required: true, min: 0, default: 0 },
        continuousStartedAt: { type: Date, required: true },
    },
    { timestamps: true }
);

rewardBoosterStateSchema.index({ guildId: 1, discordId: 1 }, { unique: true });

export const RewardBoosterState = model<IRewardBoosterState>("RewardBoosterState", rewardBoosterStateSchema);
