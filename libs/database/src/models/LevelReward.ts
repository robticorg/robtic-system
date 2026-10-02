import { Schema, model, type Document } from "mongoose";

/**
 * A role granted for reaching a message level, a voice level, or both (`/level-rewards set`).
 *
 * A requirement left `null` is not required: `{ messageLevel: 10, voiceLevel: null }` is a pure
 * message-level role, and `{ messageLevel: 10, voiceLevel: 5 }` needs both. At least one is always
 * set. One entry per role (`{guildId, roleId}` unique), so setting a role again replaces its
 * requirements.
 *
 * Rows written before the split carried a single `level`; `migrateLevelSplit` turns each into a
 * message-level requirement.
 */
export interface ILevelReward extends Document {
    guildId: string;
    roleId: string;
    messageLevel: number | null;
    voiceLevel: number | null;
    createdAt: Date;
    updatedAt: Date;
}

const levelRewardSchema = new Schema<ILevelReward>(
    {
        guildId: { type: String, required: true, index: true },
        roleId: { type: String, required: true },
        messageLevel: { type: Number, default: null, min: 1 },
        voiceLevel: { type: Number, default: null, min: 1 },
    },
    { timestamps: true }
);

levelRewardSchema.index({ guildId: 1, roleId: 1 }, { unique: true });

export const LevelReward = model<ILevelReward>("LevelReward", levelRewardSchema);
