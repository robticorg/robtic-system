import { Schema, model, type Document } from "mongoose";

export interface IActivityXP extends Document {
    discordId: string;
    guildId: string;
    username: string;
    /** Message XP + voice XP. The combined leaderboard and rank read this. */
    totalXP: number;
    /** The combined level (from `totalXP`). Kept for the combined leaderboard; level roles and the reward bonus use the two levels below. */
    level: number;
    /** XP from chat only — drives `messageLevel`. */
    messageXP: number;
    /** XP from voice only — drives `voiceLevel`. */
    voiceXP: number;
    messageLevel: number;
    voiceLevel: number;
    messageCount: number;
    /** Total non-spam, non-short messages ever sent, counted everywhere (not gated by XP channels/cooldown/role). */
    realMessageCount: number;
    lastMessageAt: Date;
    lastXPGrant: Date;
    spamCount: number;
    currentRole: string;

    staff: {
        supportPoints: number;
        publicChatPoints: number;
        staffChatPoints: number;
        moderationPoints: number;
        penalties: number;
    };

    decay: {
        enabled: boolean;
        /** Any activity at all (messages, reactions, commands, voice) — presence/AFK reads this. */
        lastActiveAt: Date;
        /** No longer drives decay (see the per-kind clocks below); kept for older readers. */
        inactiveDays: number;
        /** Last real message — the message-XP decay clock. */
        messageActiveAt: Date;
        /** Last minute of active voice — the voice-XP decay clock. */
        voiceActiveAt: Date;
        /** When message / voice XP last decayed, so each decays at most once per day. */
        messageDecayedAt: Date | null;
        voiceDecayedAt: Date | null;
    };

    createdAt: Date;
    updatedAt: Date;
}

const activityXPSchema = new Schema<IActivityXP>(
    {
        discordId: { type: String, required: true, index: true },
        guildId: { type: String, required: true, index: true },
        username: { type: String, required: true },
        totalXP: { type: Number, default: 0, index: true },
        level: { type: Number, default: 0 },
        messageXP: { type: Number, default: 0 },
        voiceXP: { type: Number, default: 0 },
        messageLevel: { type: Number, default: 0 },
        voiceLevel: { type: Number, default: 0 },
        messageCount: { type: Number, default: 0 },
        realMessageCount: { type: Number, default: 0 },
        lastMessageAt: { type: Date, default: Date.now },
        lastXPGrant: { type: Date, default: new Date(0) },
        spamCount: { type: Number, default: 0 },
        currentRole: { type: String, default: "Member" },

        staff: {
            supportPoints: { type: Number, default: 0 },
            publicChatPoints: { type: Number, default: 0 },
            staffChatPoints: { type: Number, default: 0 },
            moderationPoints: { type: Number, default: 0 },
            penalties: { type: Number, default: 0 },
        },

        decay: {
            enabled: { type: Boolean, default: true },
            lastActiveAt: { type: Date, default: Date.now },
            inactiveDays: { type: Number, default: 0 },
            messageActiveAt: { type: Date, default: Date.now },
            voiceActiveAt: { type: Date, default: Date.now },
            messageDecayedAt: { type: Date, default: null },
            voiceDecayedAt: { type: Date, default: null },
        },
    },
    { timestamps: true }
);

activityXPSchema.index({ guildId: 1, discordId: 1 }, { unique: true });
activityXPSchema.index({ guildId: 1, totalXP: -1 });

export const ActivityXP = model<IActivityXP>("ActivityXP", activityXPSchema);
