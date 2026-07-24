import { Schema, model, type Document } from "mongoose";

/** One member's coin balance in one guild, plus rolling progress toward the next earned coin. */
export interface ICoin extends Document {
    guildId: string;
    discordId: string;
    username: string;
    coins: number;
    /** Messages counted since the last message-earned coin. */
    messageProgress: number;
    /** Combo score accumulated since the last combo-earned coin. */
    comboProgress: number;
    createdAt: Date;
    updatedAt: Date;
}

const coinSchema = new Schema<ICoin>(
    {
        guildId: { type: String, required: true, index: true },
        discordId: { type: String, required: true, index: true },
        username: { type: String, required: true },
        coins: { type: Number, default: 0 },
        messageProgress: { type: Number, default: 0 },
        comboProgress: { type: Number, default: 0 },
    },
    { timestamps: true }
);

coinSchema.index({ guildId: 1, discordId: 1 }, { unique: true });
coinSchema.index({ guildId: 1, coins: -1 });

export const Coin = model<ICoin>("Coin", coinSchema);
