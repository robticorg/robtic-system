/**
 * Tuning tables for the Activity & Reward System (the "Credits" economy).
 *
 * Every number a reward calculation depends on lives here, never inline in a service, a command or
 * an event handler. Retuning a bonus is an edit in this file, not a code change anywhere else.
 */

/** 1 basis point = 0.01%. Whole-number bonus math avoids the float drift repeated percent math causes. */
export const BP_SCALE = 10_000;

/**
 * The level bonus has no hardcoded reference level. It is derived at read time from whichever
 * levels are configured on the existing `LevelReward` roles (`/level-rewards`) — the highest
 * configured level always resolves to `maxBp`, and every other configured level scales
 * proportionally to it. See `levelBonusBp` in `reward-calculator.ts`.
 */
export const REWARD_LEVEL_BONUS = {
    maxBp: 5_000,
} as const;

export const REWARD_STAFF_BONUS = {
    /** Multiplier at the lowest score that counts as staff. 10_000 = ×1 (not staff / neutral). */
    minMultiplierBp: 14_000,
    /** Multiplier at StaffTier score 100. */
    maxMultiplierBp: 16_000,
} as const;

export const REWARD_STREAK_BONUS = {
    perDayBp: 10,
    maxDays: 100,
    maxBp: 1_000,
} as const;

export const REWARD_BOOSTER_BONUS = {
    maxBp: 1_500,
    /**
     * Continuous days of boosting needed to reach the maximum bonus, by boost count — more boosts
     * reach the cap faster. A count above the table's range uses its last entry.
     *
     * Losing boosts must never leave an old, higher bonus in place: this table is read fresh from
     * the member's *current* boost count and *current* continuous duration every time, never from a
     * value stored the last time it was higher.
     */
    daysForBoostCount: [
        { boosts: 1, days: 60 },
        { boosts: 2, days: 45 },
        { boosts: 3, days: 30 },
        { boosts: 4, days: 15 },
        { boosts: 5, days: 10 },
        { boosts: 6, days: 5 },
    ],
    /**
     * How far apart two observations of the *same* continuous boosting period may be. Discord's
     * `premiumSince` and the boost announcement for a first boost land seconds apart; a
     * `premiumSince` later than the stored start by more than this means the member stopped and
     * started again while the bot was not watching, so the stored count belongs to an old period.
     */
    samePeriodToleranceMinutes: 10,
} as const;

export const REWARD_SERVER_TAG_BONUS = {
    flatBp: 1_000,
    /**
     * Hours the tag must have been continuously active *today* before it counts toward a claim.
     *
     * Without this, a member could enable the tag moments before claiming and disable it right
     * after — indistinguishable from genuine use at the instant of the claim. The requirement
     * resets every UTC day (see `RewardServerTagPresence`), so wearing it for years does not make
     * today's first activation exempt from waiting out the window again.
     */
    minContinuousHours: 6,
} as const;

export const REWARD_INVITE_BONUS = {
    perInviteBp: 100,
    /** Active credits one inviter may hold at once. A join while every slot is taken is not credited. */
    maxActiveSlots: 10,
    maxBp: 1_000,
    /** Each credit's own lifetime, from that invitee's join — never a shared weekly reset. */
    inviteDurationDays: 7,
} as const;

export const REWARD_REFERRAL_BONUS = {
    perReferralBp: 200,
    maxBp: 1_500,
} as const;


/**
 * Base reward table, in internal wallet units, read by the message/voice reward sources
 * (`libs/core/src/rewards/sources/`). Each entry is its own independently claimable daily
 * milestone — reaching 600 daily messages claims both the 300 and the 600 reward, the same way a
 * streak reward table pays every threshold crossed, not only the highest.
 *
 * Voice is measured in seconds because that is the unit `PeriodicStat`'s `voiceTime` metric is
 * already tracked in (`run-voice-tick.ts`) — comparing directly avoids a minutes/seconds rounding
 * step on every check.
 */
export const REWARD_BASE_VALUES = {
    message: [
        { dailyMessages: 300, units: 5 },
        { dailyMessages: 600, units: 50 },
    ],
    voice: [
        { dailySeconds: 5 * 60 * 60, units: 5 },
    ],
} as const;

/**
 * The conversion layer between the internal integer wallet unit and the user-facing "Credits"
 * label, kept isolated so the ratio — or the label itself — can change later without touching any
 * reward math. `1 unit` displays as `unit * displayScale` Credits (e.g. `5` → "5M Credits").
 */
export const CREDITS_DISPLAY = {
    currencyLabel: "Credits",
    displayScale: 1_000_000,
} as const;
