export interface ActivityRewardTier {
    /** The daily progress value (messages sent, or seconds spent in voice) that unlocks this tier. */
    threshold: number;
    /** Base reward, in internal wallet units, before any bonus is applied. */
    units: number;
}

/**
 * Every tier whose threshold the member's daily progress has reached, ascending.
 *
 * Each tier is independent — reaching a higher one does not exclude a lower one, the same way a
 * streak reward table pays every milestone crossed. Empty when none has been
 * reached, which is what makes a reward "only claimable once the requirement is reached".
 */
export function reachedActivityRewardTiers(
    progress: number,
    tiers: readonly ActivityRewardTier[],
): ActivityRewardTier[] {
    if (!Number.isFinite(progress) || progress <= 0) return [];
    return tiers.filter(tier => progress >= tier.threshold);
}

/**
 * Deterministic per-tier, per-day claim key.
 *
 * This is the entire idempotency mechanism: the same member claiming the same tier on the same
 * day always produces the same key, which collides against `RewardTransaction`'s partial unique
 * index on `idempotencyKey` (see `RewardWalletRepository.move`) — the existing mechanism the rest
 * of the reward core already uses, not a second one invented for activity rewards.
 */
export function dailyActivityRewardIdempotencyKey(
    kind: "message" | "voice",
    guildId: string,
    discordId: string,
    dayKey: string,
    threshold: number,
): string {
    return `${kind}-reward:${guildId}:${discordId}:${dayKey}:${threshold}`;
}
