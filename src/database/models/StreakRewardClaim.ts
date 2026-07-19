import { Schema, model, type Document } from "mongoose";

/**
 * Tracks, per user per threshold, whether the reward announcement was already sent and whether
 * they've claimed it — the mere existence of this record (regardless of `claimed`) is what stops
 * the log-channel announcement from firing again if the user loses and re-earns the same streak.
 */
export interface IStreakRewardClaim extends Document {
    guildId: string;
    discordId: string;
    threshold: number;
    notifiedAt: Date;
    claimed: boolean;
    claimedAt: Date | null;
}

const streakRewardClaimSchema = new Schema<IStreakRewardClaim>(
    {
        guildId: { type: String, required: true, index: true },
        discordId: { type: String, required: true, index: true },
        threshold: { type: Number, required: true },
        notifiedAt: { type: Date, default: () => new Date() },
        claimed: { type: Boolean, default: false },
        claimedAt: { type: Date, default: null },
    }
);

streakRewardClaimSchema.index({ guildId: 1, discordId: 1, threshold: 1 }, { unique: true });

export const StreakRewardClaim = model<IStreakRewardClaim>("StreakRewardClaim", streakRewardClaimSchema);
