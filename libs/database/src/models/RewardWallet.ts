import { Schema, model, type Document } from "mongoose";

/**
 * A member's Credits wallet in one guild — the balance behind the Activity & Reward System.
 *
 * Separate from `Point` on purpose. Points are the existing per-guild activity currency with its
 * own rates and its own conversion into RC; Credits are a distinct reward economy paid out by
 * threshold-based claims (daily messages, daily voice time, and future drops/events/quests) with a
 * staff multiplier and additive progression bonuses applied at claim time. The two never convert
 * into one another.
 *
 * Internally an integer unit; never rendered to a member as-is — see `CREDITS_DISPLAY` and
 * `formatCredits` in `libs/core/src/rewards` for the display conversion.
 */
export interface IRewardWallet extends Document {
    guildId: string;
    discordId: string;
    username: string;
    /** Spendable balance, in internal units. */
    balance: number;
    /** Lifetime earned, never decremented — spending or withdrawing reduces `balance` only. */
    lifetimeEarned: number;
    lifetimeSpent: number;
    lifetimeWithdrawn: number;
    createdAt: Date;
    updatedAt: Date;
}

const rewardWalletSchema = new Schema<IRewardWallet>(
    {
        guildId: { type: String, required: true, index: true },
        discordId: { type: String, required: true, index: true },
        username: { type: String, required: true },
        balance: { type: Number, default: 0 },
        lifetimeEarned: { type: Number, default: 0 },
        lifetimeSpent: { type: Number, default: 0 },
        lifetimeWithdrawn: { type: Number, default: 0 },
    },
    { timestamps: true }
);

rewardWalletSchema.index({ guildId: 1, discordId: 1 }, { unique: true });
rewardWalletSchema.index({ guildId: 1, balance: -1 });

export const RewardWallet = model<IRewardWallet>("RewardWallet", rewardWalletSchema);
