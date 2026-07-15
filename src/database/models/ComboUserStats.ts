import { Schema, model, type Document, type Types } from "mongoose";

export interface IComboPartnerTally {
    partnerId: string;
    score: number;
    durationMs: number;
    conversations: number;
}

export interface IComboUserStats extends Document {
    guildId: string;
    discordId: string;
    totalConversations: number;
    totalMessages: number;
    totalDurationMs: number;
    totalScoreSum: number;
    bestComboScore: number;
    bestComboPartnerId: string | null;
    longestConversationMs: number;
    bestStreakEver: number;
    /** True count of distinct partners ever conversed with — separate from `partners` since that array is capped. */
    distinctPartners: number;
    /** Bounded, sorted-by-favorite-weight tally of past partners (capped by COMBO_CONFIG.maxTrackedPartners). */
    partners: Types.DocumentArray<IComboPartnerTally>;
    createdAt: Date;
    updatedAt: Date;
}

const partnerTallySchema = new Schema<IComboPartnerTally>(
    {
        partnerId: { type: String, required: true },
        score: { type: Number, default: 0 },
        durationMs: { type: Number, default: 0 },
        conversations: { type: Number, default: 0 },
    },
    { _id: false }
);

const comboUserStatsSchema = new Schema<IComboUserStats>(
    {
        guildId: { type: String, required: true, index: true },
        discordId: { type: String, required: true },
        totalConversations: { type: Number, default: 0 },
        totalMessages: { type: Number, default: 0 },
        totalDurationMs: { type: Number, default: 0 },
        totalScoreSum: { type: Number, default: 0 },
        bestComboScore: { type: Number, default: 0 },
        bestComboPartnerId: { type: String, default: null },
        longestConversationMs: { type: Number, default: 0 },
        bestStreakEver: { type: Number, default: 0 },
        distinctPartners: { type: Number, default: 0 },
        partners: { type: [partnerTallySchema], default: [] },
    },
    { timestamps: true }
);

comboUserStatsSchema.index({ guildId: 1, discordId: 1 }, { unique: true });

export const ComboUserStats = model<IComboUserStats>("ComboUserStats", comboUserStatsSchema);
