import { Schema, model, type Document } from "mongoose";

/** Per-guild config: reaching `threshold` days of streak announces `offer` in the rewards_log channel with a claim button. */
export interface IStreakReward extends Document {
    guildId: string;
    threshold: number;
    offer: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const streakRewardSchema = new Schema<IStreakReward>(
    {
        guildId: { type: String, required: true, index: true },
        threshold: { type: Number, required: true },
        offer: { type: String, required: true },
        createdBy: { type: String, required: true },
    },
    { timestamps: true }
);

streakRewardSchema.index({ guildId: 1, threshold: 1 }, { unique: true });

export const StreakReward = model<IStreakReward>("StreakReward", streakRewardSchema);
