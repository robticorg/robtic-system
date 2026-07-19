import { Schema, model, type Document } from "mongoose";

/**
 * Per-guild settings for the ban/mute/warn shortcut + proof-of-evidence workflow.
 * `shortcutRoleIds` gates who may trigger ban/mute/warn via the text-prefix shortcut
 * (see punish-shortcut.ts); `pointsPerAction` is how many staff points a warn/mute
 * awards the moderator; `proofChannelId` is where evidence images get posted,
 * kept separate from the existing punishments_notice log channel.
 */
export interface IPunishConfig extends Document {
    guildId: string;
    shortcutRoleIds: string[];
    pointsPerAction: number;
    proofChannelId: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const punishConfigSchema = new Schema<IPunishConfig>(
    {
        guildId: { type: String, required: true, unique: true },
        shortcutRoleIds: { type: [String], default: [] },
        pointsPerAction: { type: Number, default: 1 },
        proofChannelId: { type: String, default: null },
    },
    { timestamps: true }
);

export const PunishConfig = model<IPunishConfig>("PunishConfig", punishConfigSchema);
