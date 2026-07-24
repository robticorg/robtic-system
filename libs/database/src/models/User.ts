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
    /** Profile theme color (hex "#rrggbb") — tints the whole profile for anyone viewing it. */
    profileColor?: string;
    /** Profile text color (hex "#rrggbb") shown to anyone viewing this profile. */
    textColor?: string;
    /** Banner image URL shown on the profile (Activity header + !profile embed image). */
    bannerUrl?: string;
    /** Short self-written bio shown on the profile. */
    bio?: string;
    /** Which of the Activity's profile layout templates this user picked. */
    profileTemplate?: string;
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
        profileColor: { type: String },
        textColor: { type: String },
        bannerUrl: { type: String },
        bio: { type: String },
        profileTemplate: { type: String },
    },
    { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
