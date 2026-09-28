import { PeriodicStatRepository } from "@database/repositories";
import type { PeriodicStatMetric } from "@database/models";
import { utcDateKey } from "@utils";
import { claimReward, type ClaimRewardResult, type RewardClaimType } from "../claim-reward";
import type { UnwiredRewardBonusInputs } from "../resolve-reward-bonuses";
import { reachedActivityRewardTiers, dailyActivityRewardIdempotencyKey, type ActivityRewardTier } from "./activity-reward-tiers";

export interface ActivityRewardSourceConfig {
    kind: "message" | "voice";
    /** The existing `PeriodicStat` metric this source reads daily progress from. */
    metric: PeriodicStatMetric;
    transactionType: RewardClaimType;
    tiers: readonly ActivityRewardTier[];
    detailFor: (tier: ActivityRewardTier) => string;
}

export interface ClaimActivityRewardsInput {
    guildId: string;
    discordId: string;
    username: string;
    /** The member's currently held role ids — used only to resolve the staff bonus. */
    roleIds: readonly string[];
    bonusInputs?: UnwiredRewardBonusInputs;
    /** Overrides "today" — for tests only. Defaults to now. */
    now?: Date;
}

export interface ActivityRewardClaim {
    tier: ActivityRewardTier;
    result: ClaimRewardResult;
}

/**
 * The reward-source abstraction every threshold-based daily activity reward is built from: read
 * progress from the existing `PeriodicStat` "daily" bucket for one metric, work out which
 * configured tiers it has reached, and claim each one exactly once per day through the existing
 * `claimReward` pipeline.
 *
 * Nothing here tracks activity itself — `message-stats.event.ts` and `run-voice-tick.ts` already do
 * that, via `PeriodicStatRepository.incrementAllPeriods`. This only reads what they wrote. Message
 * and voice rewards are both just this same engine pointed at a different metric and tier table —
 * see `message-reward-source.ts` and `voice-reward-source.ts`.
 */
export function createActivityRewardSource(config: ActivityRewardSourceConfig) {
    return async function claimActivityRewards(input: ClaimActivityRewardsInput): Promise<ActivityRewardClaim[]> {
        const progress = await PeriodicStatRepository.getValue(input.guildId, "daily", config.metric, input.discordId);
        const reached = reachedActivityRewardTiers(progress, config.tiers);
        if (reached.length === 0) return [];

        const now = input.now ?? new Date();
        const dayKey = utcDateKey(now);
        const claims: ActivityRewardClaim[] = [];

        for (const tier of reached) {
            const result = await claimReward({
                guildId: input.guildId,
                discordId: input.discordId,
                username: input.username,
                roleIds: input.roleIds,
                baseUnits: tier.units,
                type: config.transactionType,
                detail: config.detailFor(tier),
                idempotencyKey: dailyActivityRewardIdempotencyKey(config.kind, input.guildId, input.discordId, dayKey, tier.threshold),
                bonusInputs: input.bonusInputs,
                now,
            });

            claims.push({ tier, result });
        }

        return claims;
    };
}
