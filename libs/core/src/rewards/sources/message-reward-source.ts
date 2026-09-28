import { REWARD_BASE_VALUES } from "@constants";
import { createActivityRewardSource } from "./activity-reward-source";
import type { ActivityRewardTier } from "./activity-reward-tiers";

const MESSAGE_REWARD_TIERS: readonly ActivityRewardTier[] = REWARD_BASE_VALUES.message.map(tier => ({
    threshold: tier.dailyMessages,
    units: tier.units,
}));

/**
 * Claims every daily-message milestone (`REWARD_BASE_VALUES.message`) the member has reached and
 * not already claimed today.
 *
 * Reads the existing `PeriodicStat` "messages"/"daily" counter — the same one `message-stats.event.ts`
 * already increments on every qualifying message via `PeriodicStatRepository.incrementAllPeriods`
 * — rather than tracking anything new.
 */
export const claimMessageRewards = createActivityRewardSource({
    kind: "message",
    metric: "messages",
    transactionType: "MESSAGE_REWARD",
    tiers: MESSAGE_REWARD_TIERS,
    detailFor: tier => `${tier.threshold} daily messages`,
});
