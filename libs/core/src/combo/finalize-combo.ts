import type { ICombo } from "@database/models";
import { ComboRepository, ComboUserStatsRepository } from "@database/repositories";
import { Logger } from "@logger";
import { checkFinalRecords } from "./records";
import { recordEndedCombo } from "./record-ended-combo";
import { recordFavoritePartnerScore } from "./record-favorite-partner-score";
import { rollConversationStreak } from "./conversation-streak";

const CTX = "combo";

/**
 * Archives an ended conversation: rolls the conversation streak forward, writes history, updates
 * both participants' aggregate stats, and checks server records/leaderboard entries that only
 * finalize at combo-end.
 *
 * Runs from two processes — the worker (a message finds its pair stale) and the Gateway's
 * scheduler sweep — so ending is a conditional write: only the call that actually flips the pair
 * from active to ended archives it. The other one does nothing.
 */
export async function finalizeCombo(pair: ICombo): Promise<void> {
    if (pair.status === "ended") return;

    const now = new Date();
    const userAId = pair.userLowId;
    const userBId = pair.userHighId;

    const roll = pair.messages > 0
        ? rollConversationStreak(pair.streakCurrent, pair.streakBest, pair.lastStreakDateKey, now)
        : { streakCurrent: pair.streakCurrent, streakBest: pair.streakBest, dateKey: pair.lastStreakDateKey };
    const { streakCurrent, streakBest, dateKey } = roll;

    const ended = await ComboRepository.endWithStreak(pair.guildId, userAId, userBId, streakCurrent, streakBest, dateKey);
    if (!ended || pair.messages === 0) return;

    try {
        await recordEndedCombo(pair, now);
        await ComboUserStatsRepository.applyComboEnd(pair.guildId, userAId, userBId, {
            score: pair.currentScore,
            durationMs: pair.totalDurationMs,
            messages: pair.messages,
            streakCurrent,
        });
        await checkFinalRecords(pair.guildId, pair, userAId, userBId, streakCurrent);
        await recordFavoritePartnerScore(pair.guildId, userAId, userBId);
    } catch (err) {
        Logger.error(`Failed to finalize combo ${pair.guildId}:${userAId}:${userBId}: ${err}`, CTX);
    }
}
