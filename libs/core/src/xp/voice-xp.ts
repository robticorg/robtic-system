import { ActivityLogRepository, ActivityRepository, PeriodicStatRepository, PointsRepository } from "@database/repositories";
import type { ActivityLogType } from "@database/models/ActivityLog";
import { COMBO_LEADERBOARD_PERIODS, type ComboLeaderboardPeriod } from "@constants";
import { periodKeyFor } from "@utils";
import { getPointRates } from "../points/get-point-rates";
import { calculateLevel } from "./calculate-level";
import type { Levels } from "./message-xp";

/**
 * Queued voice XP — one member's share of one voice tick, applied by the worker exactly once.
 * `applyMessageXp`'s twin: the Gateway decided the member was eligible (it has the voice states)
 * and rolled the XP; this writes the XP with a levels-before snapshot, the period stats (`xp`,
 * `voiceXp`, `voiceTime`), the logs and the voice Points — every step keyed by the tick, so a
 * retried tick changes nothing it already changed. A voice level-up is returned for the caller
 * to send to the Gateway (level roles, announcement).
 */

export interface VoiceXpInput {
    guildId: string;
    memberId: string;
    username: string;
    xp: number;
    /** Active (eligible) seconds this tick. */
    seconds: number;
    at: Date;
    /** Identifies the tick: the same for every member of one guild's tick. */
    tickKey: string;
}

type VoiceMetric = "xp" | "voiceXp" | "voiceTime";

export interface VoiceXpStore {
    addXpOnce(input: VoiceXpInput, jobKey: string): Promise<{ record: { totalXP: number; voiceXP: number } | null; prev: Levels | null }>;
    addPeriod(input: VoiceXpInput, metric: VoiceMetric, period: ComboLeaderboardPeriod, periodKey: string, amount: number, jobKey: string): Promise<unknown>;
    raiseLevels(input: VoiceXpInput, levels: Partial<Levels>): Promise<void>;
    logOnce(key: string, input: VoiceXpInput, type: ActivityLogType, amount: number, details?: string): Promise<unknown>;
    addPoints(input: VoiceXpInput, activeMinutes: number, jobKey: string): Promise<number>;
}

export const repositoryVoiceXpStore: VoiceXpStore = {
    addXpOnce: (i, jobKey) => ActivityRepository.addVoiceXpOnce(i.memberId, i.guildId, i.username, i.xp, i.at, jobKey),
    addPeriod: (i, metric, period, periodKey, amount, jobKey) =>
        PeriodicStatRepository.incrementBatch(i.guildId, period, periodKey, metric, i.memberId, amount, jobKey),
    raiseLevels: (i, levels) => ActivityRepository.raiseLevels(i.memberId, i.guildId, levels),
    logOnce: (key, i, type, amount, details) => ActivityLogRepository.logOnce(key, { guildId: i.guildId, userId: i.memberId, type, amount, details }),
    addPoints: async (i, activeMinutes, jobKey) => {
        const { voiceMinutesPerPoint } = await getPointRates(i.guildId);
        return PointsRepository.addProgressOnce(i.guildId, i.memberId, i.username, "voice", activeMinutes, voiceMinutesPerPoint, jobKey);
    },
};

export type VoiceXpOutcome =
    | { status: "applied"; leveledUp: boolean; previousLevel: number; newLevel: number; messageLevel: number; points: number }
    | { status: "superseded" };

export async function applyVoiceXp(input: VoiceXpInput, store: VoiceXpStore = repositoryVoiceXpStore): Promise<VoiceXpOutcome> {
    const jobKey = `voice-${input.tickKey}`;
    const { record, prev } = await store.addXpOnce(input, jobKey);
    if (!record) return { status: "superseded" };

    for (const period of COMBO_LEADERBOARD_PERIODS) {
        const periodKey = periodKeyFor(period, input.at);
        await store.addPeriod(input, "xp", period, periodKey, input.xp, jobKey);
        await store.addPeriod(input, "voiceXp", period, periodKey, input.xp, jobKey);
        await store.addPeriod(input, "voiceTime", period, periodKey, input.seconds, jobKey);
    }

    // A newer tick replaced this one's snapshot (a late retry): the XP is in, so finish the guarded
    // writes; the level-up decision belongs to the newer tick, which saw this XP.
    if (!prev) {
        await store.logOnce(`${jobKey}-${input.memberId}-gain`, input, "xp_gain", input.xp);
        await store.addPoints(input, input.seconds / 60, jobKey);
        return { status: "superseded" };
    }

    const newLevel = calculateLevel(record.voiceXP);
    const leveledUp = newLevel > prev.voiceLevel;
    const combinedLevel = calculateLevel(record.totalXP);
    if (leveledUp || combinedLevel > prev.level) {
        await store.raiseLevels(input, { level: combinedLevel, ...(leveledUp ? { voiceLevel: newLevel } : {}) });
    }

    if (leveledUp) await store.logOnce(`${jobKey}-${input.memberId}-level`, input, "level_up", newLevel, `Voice level ${prev.voiceLevel} → ${newLevel}`);
    await store.logOnce(`${jobKey}-${input.memberId}-gain`, input, "xp_gain", input.xp);

    const points = await store.addPoints(input, input.seconds / 60, jobKey);

    return { status: "applied", leveledUp, previousLevel: prev.voiceLevel, newLevel, messageLevel: prev.messageLevel, points };
}
