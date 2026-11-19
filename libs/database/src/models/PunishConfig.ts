import { Schema, model, type Document } from "mongoose";

/** Per-guild settings for the ban/mute/warn shortcut + proof-of-evidence workflow. */
export interface IPunishConfig extends Document {
    guildId: string;
    shortcutRoleIds: string[];
    pointsPerAction: number;
    proofChannelId: string | null;
    /** Set once the server edits its reasons on the dashboard: only its own reasons count, the shared ones no longer
     *  apply (so a shared reason it deleted doesn't come back). */
    ownReasonsOnly: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const punishConfigSchema = new Schema<IPunishConfig>(
    {
        guildId: { type: String, required: true, unique: true },
        shortcutRoleIds: { type: [String], default: [] },
        pointsPerAction: { type: Number, default: 1 },
        proofChannelId: { type: String, default: null },
        ownReasonsOnly: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const PunishConfig = model<IPunishConfig>("PunishConfig", punishConfigSchema);
