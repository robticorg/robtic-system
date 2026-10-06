import { ActivityLogRepository, ActivityRepository, PeriodicStatRepository } from "@database/repositories";
import type { ActivityLogType } from "@database/models/ActivityLog";
import { COMBO_LEADERBOARD_PERIODS, type ComboLeaderboardPeriod } from "@constants";
import { periodKeyFor } from "@utils";
import { calculateLevel } from "./calculate-level";

/**
 * Queued chat XP — what the worker does with one `xp` job. The Gateway has already decided the
 * message earns XP and rolled the amount; this applies it, exactly once per job:
 *
 * - the XP lands with a snapshot of the levels before it, in one guarded write, so a retry after a
 *   crash still knows whether this gain was a level-up;
 * - period stats are guarded by the job key, logs by a unique key;
 * - levels are only ever raised, so two gains finishing out of order can't lower one.
 *
 * Discord work (level roles, the announcement, the log channel) is returned for the caller to queue
 * to the Gateway — the worker has no Discord connection.
 */

export interface MessageXpInput {
    guildId: string;
    memberId: string;
    username: string;
    messageId: string;
    xp: number;
    at: Date;
}

export interface Levels {
    level: number;
    messageLevel: number;
    voiceLevel: number;
}

export interface MessageXpStore {
    addXpOnce(input: MessageXpInput, jobKey: string): Promise<{ record: { totalXP: number; messageXP: number } | null; prev: Levels | null }>;
    addPeriod(input: MessageXpInput, metric: "xp" | "messageXp", period: ComboLeaderboardPeriod, periodKey: string, jobKey: string): Promise<unknown>;
    raiseLevels(input: MessageXpInput, levels: Partial<Levels>): Promise<void>;
    logOnce(key: string, input: MessageXpInput, type: ActivityLogType, amount: number, details?: string): Promise<unknown>;
}

export const repositoryMessageXpStore: MessageXpStore = {
    addXpOnce: (i, jobKey) => ActivityRepository.addMessageXpOnce(i.memberId, i.guildId, i.username, i.xp, i.at, jobKey),
    addPeriod: (i, metric, period, periodKey, jobKey) =>
        PeriodicStatRepository.incrementBatch(i.guildId, period, periodKey, metric, i.memberId, i.xp, jobKey),
    raiseLevels: (i, levels) => ActivityRepository.raiseLevels(i.memberId, i.guildId, levels),
    logOnce: (key, i, type, amount, details) => ActivityLogRepository.logOnce(key, { guildId: i.guildId, userId: i.memberId, type, amount, details }),
};

export type MessageXpOutcome =
    | { status: "applied"; leveledUp: boolean; previousLevel: number; newLevel: number; voiceLevel: number }
    /** The member's row is gone, or a newer gain already replaced this one's snapshot. */
    | { status: "superseded" };

export async function applyMessageXp(input: MessageXpInput, store: MessageXpStore = repositoryMessageXpStore): Promise<MessageXpOutcome> {
    const jobKey = `xp-${input.messageId}`;
    const { record, prev } = await store.addXpOnce(input, jobKey);
    if (!record) return { status: "superseded" };

    for (const period of COMBO_LEADERBOARD_PERIODS) {
        const periodKey = periodKeyFor(period, input.at);
        await store.addPeriod(input, "messageXp", period, periodKey, jobKey);
        await store.addPeriod(input, "xp", period, periodKey, jobKey);
    }

    // A newer gain replaced this one's snapshot (a late retry): the XP is in, so finish the guarded
    // writes; the level-up decision belongs to the newer gain, which saw this XP.
    if (!prev) {
        await store.logOnce(`${jobKey}-gain`, input, "xp_gain", input.xp);
        return { status: "superseded" };
    }

    const newLevel = calculateLevel(record.messageXP);
    const leveledUp = newLevel > prev.messageLevel;
    const combinedLevel = calculateLevel(record.totalXP);
    if (leveledUp || combinedLevel > prev.level) {
        await store.raiseLevels(input, { level: combinedLevel, ...(leveledUp ? { messageLevel: newLevel } : {}) });
    }

    if (leveledUp) {
        await store.logOnce(`${jobKey}-level`, input, "level_up", newLevel, `Message level ${prev.messageLevel} → ${newLevel}`);
    }
    await store.logOnce(`${jobKey}-gain`, input, "xp_gain", input.xp);

    return { status: "applied", leveledUp, previousLevel: prev.messageLevel, newLevel, voiceLevel: prev.voiceLevel };
}
