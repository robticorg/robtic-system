import { Combo, type ICombo } from "@database/models/Combo";
import { COMBO_LEVELS } from "@constants";
import { buildLevelSwitchExpr } from "@core/combo/build-level-switch-expr";

function pairKey(a: string, b: string): [string, string] {
    return a < b ? [a, b] : [b, a];
}

export class ComboRepository {
    static async find(guildId: string, userAId: string, userBId: string): Promise<ICombo | null> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        return Combo.findOne({ guildId, userLowId, userHighId });
    }

    static async findOrCreate(guildId: string, userAId: string, userBId: string): Promise<ICombo> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        let pair = await Combo.findOne({ guildId, userLowId, userHighId });
        if (!pair) {
            pair = await Combo.create({ guildId, userLowId, userHighId });
        }
        return pair;
    }

    /** Resets a pair's per-conversation fields to start a fresh combo, keeping streak/identity fields intact. */
    static async restart(guildId: string, userAId: string, userBId: string, now: Date): Promise<ICombo | null> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        return Combo.findOneAndUpdate(
            { guildId, userLowId, userHighId },
            {
                $set: {
                    status: "active",
                    currentScore: 0,
                    bestScore: 0,
                    messages: 0,
                    totalDurationMs: 0,
                    totalWords: 0,
                    totalCharacters: 0,
                    heat: 0,
                    level: COMBO_LEVELS[0].name,
                    startedAt: now,
                    lastMessageAt: now,
                    lastMessageAtLow: now,
                    lastMessageAtHigh: now,
                    lastMessageBy: "",
                },
            },
            { upsert: true, returnDocument: "after" }
        );
    }

    /**
     * Atomically applies a qualifying message to an already-active pair (avoids lost-update races
     * on concurrent messages) — at most once per `messageId`: the pair remembers its last 20
     * message ids, so a retried job returns null instead of counting the message again. Times
     * only move forward, so a message applied late can't rewind the pair's clocks.
     */
    static async applyMessage(
        guildId: string,
        userAId: string,
        userBId: string,
        senderId: string,
        scoreGain: number,
        heat: number,
        durationDeltaMs: number,
        wordCount: number,
        characterCount: number,
        now: Date,
        messageId: string,
    ): Promise<ICombo | null> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        const senderTimestampField = senderId === userLowId ? "lastMessageAtLow" : "lastMessageAtHigh";
        const later = (field: string) => ({ $max: [{ $ifNull: [`$${field}`, now] }, now] });
        return Combo.findOneAndUpdate(
            { guildId, userLowId, userHighId, appliedMessages: { $ne: messageId } },
            [
                {
                    $set: {
                        appliedMessages: { $slice: [{ $concatArrays: [{ $ifNull: ["$appliedMessages", []] }, [messageId]] }, -20] },
                        currentScore: { $add: ["$currentScore", scoreGain] },
                        messages: { $add: ["$messages", 1] },
                        totalDurationMs: { $add: ["$totalDurationMs", durationDeltaMs] },
                        totalWords: { $add: [{ $ifNull: ["$totalWords", 0] }, wordCount] },
                        totalCharacters: { $add: [{ $ifNull: ["$totalCharacters", 0] }, characterCount] },
                        heat,
                        lastMessageBy: senderId,
                        lastMessageAt: later("lastMessageAt"),
                        [senderTimestampField]: later(senderTimestampField),
                        status: "active",
                    },
                },
                {
                    $set: {
                        bestScore: { $max: ["$bestScore", "$currentScore"] },
                        level: buildLevelSwitchExpr("$currentScore"),
                    },
                },
            ],
            { returnDocument: "after", updatePipeline: true }
        );
    }

    static async setHeat(guildId: string, userAId: string, userBId: string, heat: number): Promise<void> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        await Combo.updateOne({ guildId, userLowId, userHighId }, { $set: { heat } });
    }

    /**
     * Marks a pair ended and persists its (possibly updated) conversation-streak fields in one
     * write — only if it is still active. Returns whether this call ended it, so when the Gateway's
     * scheduler and a worker both see a stale pair, exactly one of them archives the conversation.
     */
    static async endWithStreak(
        guildId: string,
        userAId: string,
        userBId: string,
        streakCurrent: number,
        streakBest: number,
        streakDateKey: string,
    ): Promise<boolean> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        const result = await Combo.updateOne(
            { guildId, userLowId, userHighId, status: "active" },
            { $set: { status: "ended", streakCurrent, streakBest, lastStreakDateKey: streakDateKey } }
        );
        return result.modifiedCount > 0;
    }

    static async findAllActive(guildId: string): Promise<ICombo[]> {
        return Combo.find({ guildId, status: "active" });
    }

    static async findActiveForUser(guildId: string, userId: string): Promise<ICombo[]> {
        return Combo.find({
            guildId,
            status: "active",
            $or: [{ userLowId: userId }, { userHighId: userId }],
        });
    }
}
