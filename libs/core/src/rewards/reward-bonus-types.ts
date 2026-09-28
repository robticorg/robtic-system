/**
 * Raw inputs a reward bonus calculation needs, already read from wherever each fact lives.
 *
 * Sources with their own database records (level, streak days, staff score, the premium percent)
 * are resolved for real in `resolve-reward-bonuses.ts`. Server tag has no database record by
 * design — it is live Discord state, resolved for real via `isServerTagActive` from whatever the
 * caller reads off `member.user.primaryGuild` — see `resolve-reward-bonuses.ts`'s
 * `UnwiredRewardBonusInputs` for how it reaches here. Booster (`booster-state.ts`) and invite
 * (`invite-credit.ts`) are resolved from their own minimal state. Referral has no tracking system
 * yet; it is still a first-class field here so a future system fills it in without this shape, the
 * calculator, or anything downstream changing.
 */
export interface RewardBonusInputs {
    /** The member's current level (existing XP/level system). 0 = no bonus. */
    level?: number;
    /**
     * Every level configured on the existing `LevelReward` roles for this guild (`/level-rewards`),
     * as plain level numbers — order and role ids don't matter here. The level bonus is derived
     * from these at read time; see `levelBonusBp`. Empty (no roles configured) means no bonus.
     */
    configuredLevelPoints?: readonly number[];
    /** The member's best-matching StaffTier score, 0-100. 0 (or absent) = not staff. */
    staffScore?: number;
    /** Current consecutive streak days (existing streak system). */
    streakDays?: number;
    /** Current number of active server boosts. */
    boosterCount?: number;
    /** Days the current boost count has been held continuously, without a gap. */
    boosterContinuousDays?: number;
    /** Whether the member currently has this guild's Server Tag displayed — see `isServerTagActive`. */
    hasServerTag?: boolean;
    /** Currently active invite slots (each lasts a fixed duration — see `REWARD_INVITE_BONUS`). */
    activeInviteSlots?: number;
    /** Qualified referrals, for members eligible to hold a referral code. */
    qualifiedReferrals?: number;
    /** The `REWARD_BONUS` premium feature's resolved percent (e.g. 5 for +5%). */
    premiumBonusPercent?: number;
}

/**
 * Every bonus source, already resolved to basis points and clamped to its configured maximum.
 *
 * `staffMultiplierBp` is the one multiplicative term (10_000 = ×1, neutral); every other field is
 * additive. See `calculateReward` for how they combine.
 */
export interface RewardBonusBreakdown {
    staffMultiplierBp: number;
    levelBp: number;
    streakBp: number;
    boosterBp: number;
    serverTagBp: number;
    inviteBp: number;
    referralBp: number;
    premiumBp: number;
}
