import { Schema, model, type Document } from "mongoose";
import type { ComboLeaderboardPeriod, ComboLeaderboardType } from "@core/config";

export interface IComboLeaderboardEntry extends Document {
    guildId: string;
    period: ComboLeaderboardPeriod;
    periodKey: string;
    type: ComboLeaderboardType;
    discordId: string;
    value: number;
    createdAt: Date;
    updatedAt: Date;
}

const comboLeaderboardEntrySchema = new Schema<IComboLeaderboardEntry>(
    {
        guildId: { type: String, required: true },
        period: { type: String, enum: ["daily", "weekly", "monthly", "alltime"], required: true },
        periodKey: { type: String, required: true },
        type: { type: String, enum: ["combo", "streak", "partner"], required: true },
        discordId: { type: String, required: true },
        value: { type: Number, required: true, default: 0 },
    },
    { timestamps: true }
);

comboLeaderboardEntrySchema.index(
    { guildId: 1, period: 1, periodKey: 1, type: 1, discordId: 1 },
    { unique: true }
);
comboLeaderboardEntrySchema.index({ guildId: 1, period: 1, periodKey: 1, type: 1, value: -1 });

export const ComboLeaderboardEntry = model<IComboLeaderboardEntry>("ComboLeaderboardEntry", comboLeaderboardEntrySchema);
