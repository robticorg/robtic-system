import { Schema, model, type Document } from "mongoose";

export interface IUser extends Document {
    discordId: string;
    username: string;
    joinedAt: Date;
    roles: string[];
    warnings: number;
    punishmentLevel: number;
    isBanned: boolean;
    notes: string[];
    /** Explicit self-service language override (set via /profile Settings), takes priority over guild-role-based detection. */
    preferredLang?: "en" | "ar";
    /** Bot-tracked cosmetic display name override (not a real Discord nickname) shown in profile/leaderboards. */
    displayName?: string;
    /** When true, other users viewing this member's /profile only see a minimal field set (name, xp, account age, join date, combo, streak). */
    privateProfile?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>(
    {
        discordId: { type: String, required: true, unique: true, index: true },
        username: { type: String, required: true },
        joinedAt: { type: Date, default: Date.now },
        roles: [{ type: String }],
        warnings: { type: Number, default: 0 },
        punishmentLevel: { type: Number, default: 0 },
        isBanned: { type: Boolean, default: false },
        notes: [{ type: String }],
        preferredLang: { type: String, enum: ["en", "ar"] },
        displayName: { type: String },
        privateProfile: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
