import { Combo, type ICombo } from "@database/models/Combo";
import { COMBO_LEVELS } from "@core/config";
import { buildLevelSwitchExpr } from "@core/utils";

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
                    lastMessageBy: "",
                },
            },
            { upsert: true, returnDocument: "after" }
        );
    }

    /** Atomically applies a qualifying message to an already-active pair (avoids lost-update races on concurrent messages). */
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
    ): Promise<ICombo | null> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        return Combo.findOneAndUpdate(
            { guildId, userLowId, userHighId },
            [
                {
                    $set: {
                        currentScore: { $add: ["$currentScore", scoreGain] },
                        messages: { $add: ["$messages", 1] },
                        totalDurationMs: { $add: ["$totalDurationMs", durationDeltaMs] },
                        totalWords: { $add: [{ $ifNull: ["$totalWords", 0] }, wordCount] },
                        totalCharacters: { $add: [{ $ifNull: ["$totalCharacters", 0] }, characterCount] },
                        heat,
                        lastMessageBy: senderId,
                        lastMessageAt: now,
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
            { returnDocument: "after" }
        );
    }

    static async setHeat(guildId: string, userAId: string, userBId: string, heat: number): Promise<void> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        await Combo.updateOne({ guildId, userLowId, userHighId }, { $set: { heat } });
    }

    /** Marks a pair ended and persists its (possibly updated) conversation-streak fields in one write. */
    static async endWithStreak(
        guildId: string,
        userAId: string,
        userBId: string,
        streakCurrent: number,
        streakBest: number,
        streakDateKey: string,
    ): Promise<void> {
        const [userLowId, userHighId] = pairKey(userAId, userBId);
        await Combo.updateOne(
            { guildId, userLowId, userHighId },
            { $set: { status: "ended", streakCurrent, streakBest, lastStreakDateKey: streakDateKey } }
        );
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
