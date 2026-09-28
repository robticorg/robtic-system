/**
 * The Activity & Reward System's core — the "Credits" economy.
 *
 * A pure calculator (`calculateReward`), a resolver that reuses the existing staff/level/streak/
 * systems (`resolveRewardBonuses`), a centralized wallet service, and one orchestrating
 * entry point (`claimReward`) future reward sources call. No discord.js anywhere in this folder.
 */

export {
    calculateReward,
    calculateBonusBreakdown,
    levelBonusBp,
    streakBonusBp,
    boosterBonusBp,
    boosterDaysToMax,
    staffMultiplierBp,
    serverTagBonusBp,
    inviteBonusBp,
    referralBonusBp,
    type RewardCalculation,
} from "./reward-calculator";

export type { RewardBonusInputs, RewardBonusBreakdown } from "./reward-bonus-types";

export { resolveRewardBonuses, type UnwiredRewardBonusInputs } from "./resolve-reward-bonuses";

export { isServerTagActive, type PrimaryGuildIdentity } from "./server-tag";

export {
    decideServerTagPresence,
    resolveServerTagEligibility,
    type ServerTagPresenceDecision,
} from "./server-tag-presence";

export {
    continuousDaysSince,
    effectiveBoostCount,
    applyPremiumSince,
    applyBoostAnnouncement,
    reconcileBoostCounts,
    planGuildBoosterSync,
    observeBoosterPremiumSince,
    recordBoostAnnouncement,
    clearBoosterState,
    syncGuildBoosters,
    getBoosterProgress,
    type BoosterStateSnapshot,
    type BoosterProgress,
    type GuildBoosterSyncPlan,
} from "./booster-state";

export {
    inviteExpiresAt,
    isInviteCreditActive,
    countActiveInviteCredits,
    decideInviteCredit,
    detectUsedInvite,
    recordInviteeJoin,
    recordInviteeLeave,
    getActiveInviteCount,
    type InviteCreditDecision,
    type InviteUseSnapshot,
    type InviteCreditStore,
} from "./invite-credit";

export { creditReward, debitReward, withdrawReward, type RewardWalletMovement } from "./reward-wallet-service";

export { unitsToCredits, formatCredits } from "./format-credits";

export { claimReward, type ClaimRewardInput, type ClaimRewardResult, type RewardClaimType } from "./claim-reward";

export {
    reachedActivityRewardTiers,
    dailyActivityRewardIdempotencyKey,
    type ActivityRewardTier,
} from "./sources/activity-reward-tiers";

export {
    createActivityRewardSource,
    type ActivityRewardSourceConfig,
    type ClaimActivityRewardsInput,
    type ActivityRewardClaim,
} from "./sources/activity-reward-source";

export { claimMessageRewards } from "./sources/message-reward-source";
export { claimVoiceRewards } from "./sources/voice-reward-source";
