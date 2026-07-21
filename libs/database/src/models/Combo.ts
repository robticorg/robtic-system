import { Schema, model, type Document } from "mongoose";
import { COMBO_LEVELS } from "@core/config";

export type ComboStatus = "active" | "ended";

/**
 * One document per unordered user pair (userLowId < userHighId), reused across the pair's
 * entire lifetime — a combo "restarting" resets score/heat/etc but keeps streak fields, since
 * Conversation Streak tracks consecutive days, not a single conversation's continuous lifetime.
 */
export interface ICombo extends Document {
    guildId: string;
    userLowId: string;
    userHighId: string;
    status: ComboStatus;
    currentScore: number;
    bestScore: number;
    messages: number;
    totalDurationMs: number;
    totalWords: number;
    totalCharacters: number;
    heat: number;
    level: string;
    lastMessageBy: string;
    lastMessageAt: Date;
    /** Per-participant last-qualifying-message time — the combo goes stale the moment EITHER side's own timer exceeds the expiry, not just when both go quiet, so one person ignoring the other for 2m ends it. */
    lastMessageAtLow: Date;
    lastMessageAtHigh: Date;
    startedAt: Date;
    streakCurrent: number;
    streakBest: number;
    lastStreakDateKey: string;
    createdAt: Date;
    updatedAt: Date;
}

const comboSchema = new Schema<ICombo>(
    {
        guildId: { type: String, required: true, index: true },
        userLowId: { type: String, required: true },
        userHighId: { type: String, required: true },
        status: { type: String, enum: ["active", "ended"], default: "active", index: true },
        currentScore: { type: Number, default: 0 },
        bestScore: { type: Number, default: 0 },
        messages: { type: Number, default: 0 },
        totalDurationMs: { type: Number, default: 0 },
        totalWords: { type: Number, default: 0 },
        totalCharacters: { type: Number, default: 0 },
        heat: { type: Number, default: 0 },
        level: { type: String, default: COMBO_LEVELS[0].name },
        lastMessageBy: { type: String, default: "" },
        lastMessageAt: { type: Date, default: () => new Date() },
        lastMessageAtLow: { type: Date, default: () => new Date() },
        lastMessageAtHigh: { type: Date, default: () => new Date() },
        startedAt: { type: Date, default: () => new Date() },
        streakCurrent: { type: Number, default: 0 },
        streakBest: { type: Number, default: 0 },
        lastStreakDateKey: { type: String, default: "" },
    },
    { timestamps: true }
);

comboSchema.index({ guildId: 1, userLowId: 1, userHighId: 1 }, { unique: true });
comboSchema.index({ guildId: 1, status: 1, currentScore: -1 });

export const Combo = model<ICombo>("Combo", comboSchema);
