import { Schema, model, type Document } from "mongoose";

export interface ICoinStreakReward {
    /** Streak day-count that triggers the payout. */
    streak: number;
    coins: number;
}

/** Per-guild coin economy tuning (see COIN_DEFAULTS for fallbacks). */
export interface ICoinSettings extends Document {
    guildId: string;
    /** Real messages needed per earned coin. */
    messagesPerCoin: number;
    /** Combo score needed per earned coin. */
    comboPerCoin: number;
    /** Streak day-counts that pay out coins when reached (e.g. 5 → 1, 15 → 2). */
    streakRewards: ICoinStreakReward[];
    createdAt: Date;
    updatedAt: Date;
}

const coinSettingsSchema = new Schema<ICoinSettings>(
    {
        guildId: { type: String, required: true, unique: true, index: true },
        messagesPerCoin: { type: Number, default: 100 },
        comboPerCoin: { type: Number, default: 100 },
        streakRewards: {
            type: [{
                streak: { type: Number, required: true },
                coins: { type: Number, required: true },
                _id: false,
            }],
            default: [],
        },
    },
    { timestamps: true }
);

export const CoinSettings = model<ICoinSettings>("CoinSettings", coinSettingsSchema);
