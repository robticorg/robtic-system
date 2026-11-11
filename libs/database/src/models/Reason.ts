import { Schema, model, type Document } from "mongoose";

/**
 * A pick-from-a-list punishment reason. `guildId` is the server that owns it; a reason without one is shared
 * (made before reasons were per server) and every server sees it unless it has its own reason with the same key.
 */
export interface IReason extends Document {
    key: string;
    guildId?: string | null;
    label: string;
    labelAr: string;
    type: "warn" | "mute" | "ban";
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const reasonSchema = new Schema<IReason>(
    {
        key: { type: String, required: true, index: true },
        guildId: { type: String, default: null },
        label: { type: String, required: true },
        labelAr: { type: String, required: true },
        type: { type: String, enum: ["warn", "mute", "ban"], required: true },
        createdBy: { type: String, required: true },
    },
    { timestamps: true }
);

reasonSchema.index({ guildId: 1, key: 1 }, { unique: true });

export const Reason = model<IReason>("Reason", reasonSchema);
