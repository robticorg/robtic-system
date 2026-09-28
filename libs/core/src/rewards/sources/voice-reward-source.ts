import { REWARD_BASE_VALUES } from "@constants";
import { createActivityRewardSource } from "./activity-reward-source";
import type { ActivityRewardTier } from "./activity-reward-tiers";

const VOICE_REWARD_TIERS: readonly ActivityRewardTier[] = REWARD_BASE_VALUES.voice.map(tier => ({
    threshold: tier.dailySeconds,
    units: tier.units,
}));

/**
 * Claims every daily-voice milestone (`REWARD_BASE_VALUES.voice`) the member has reached and not
 * already claimed today.
 *
 * Reads the existing `PeriodicStat` "voiceTime"/"daily" counter, in seconds — the same one
 * `run-voice-tick.ts` already increments on every eligible tick via
 * `PeriodicStatRepository.incrementAllPeriods` — rather than tracking anything new.
 */
export const claimVoiceRewards = createActivityRewardSource({
    kind: "voice",
    metric: "voiceTime",
    transactionType: "VOICE_REWARD",
    tiers: VOICE_REWARD_TIERS,
    detailFor: tier => `${Math.round(tier.threshold / 3600)}h daily voice`,
});
