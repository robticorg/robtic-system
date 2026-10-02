/**
 * Raw inputs a reward bonus calculation needs, already read from wherever each fact lives.
 *
 * Sources with their own database records (level, streak days, staff score)
 * are resolved for real in `resolve-reward-bonuses.ts`. Server tag has no database record by
 * design — it is live Discord state, resolved for real via `isServerTagActive` from whatever the
 * caller reads off `member.user.primaryGuild` — see `resolve-reward-bonuses.ts`'s
 * `UnwiredRewardBonusInputs` for how it reaches here. Booster (`booster-state.ts`) and invite
 * (`invite-credit.ts`) are resolved from their own minimal state, and Referral from the member's
 * applied referral code (`referral-code.ts`).
 */
export interface RewardBonusInputs {
    /** The member's current message level. */
    messageLevel?: number;
    /** The member's current voice level. */
    voiceLevel?: number;
    /**
     * Every level-reward role configured in this guild (`/level-rewards`) — each a required message
     * level, voice level, or both. The level bonus is derived from these at read time; see
     * `levelBonusBp`. Empty (no roles configured) means no bonus.
     */
    levelRewards?: readonly { messageLevel: number | null; voiceLevel: number | null }[];
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
    /**
     * The configured bonus of the member's referral code — already 0 unless that code exists and is
     * active (see `referralCodeBonusBp`). Clamped to the +15% cap again by the calculator.
     */
    referralCodeBp?: number;
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
}
