import { Schema, model, type Document } from "mongoose";

export interface IStreakRecovery extends Document {
    discordId: string;
    guildId: string;
    currentStreak: number;
    bestStreak: number;
    expiredAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const streakRecoverySchema = new Schema<IStreakRecovery>(
    {
        discordId: { type: String, required: true, index: true },
        guildId: { type: String, required: true, index: true },
        currentStreak: { type: Number, required: true },
        bestStreak: { type: Number, required: true },
        expiredAt: { type: Date, required: true },
    },
    { timestamps: true }
);

streakRecoverySchema.index({ guildId: 1, discordId: 1 }, { unique: true });

export const StreakRecovery = model<IStreakRecovery>("StreakRecovery", streakRecoverySchema);
