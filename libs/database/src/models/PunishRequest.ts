import { Schema, model, type Document } from "mongoose";

/**
 * A punishment waiting on something: proof from the moderator (`proof`) or a senior's decision (`pending`). Buttons
 * and forms carry only this row's id, so a long or free-text reason never has to fit in Discord's 100-character
 * custom id, and an approval can be claimed exactly once. Rows are dropped 30 days after they're made.
 */
export interface IPunishRequest extends Document {
    guildId: string;
    type: "warn" | "mute" | "ban";
    targetId: string;
    reasonKey: string;
    moderatorId: string;
    /** Mute hours, jail days or "perm"; "none" for a warning. */
    extra: string;
    proofUrl: string | null;
    status: "proof" | "pending" | "approved" | "denied";
    decidedBy: string | null;
    expiresAt: Date;
}

const punishRequestSchema = new Schema<IPunishRequest>(
    {
        guildId: { type: String, required: true },
        type: { type: String, enum: ["warn", "mute", "ban"], required: true },
        targetId: { type: String, required: true },
        reasonKey: { type: String, required: true },
        moderatorId: { type: String, required: true },
        extra: { type: String, default: "none" },
        proofUrl: { type: String, default: null },
        status: { type: String, enum: ["proof", "pending", "approved", "denied"], required: true },
        decidedBy: { type: String, default: null },
        expiresAt: { type: Date, required: true },
    },
    { timestamps: true },
);

punishRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PunishRequest = model<IPunishRequest>("PunishRequest", punishRequestSchema);
