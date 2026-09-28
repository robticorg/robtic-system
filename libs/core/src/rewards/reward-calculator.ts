import {
    BP_SCALE,
    REWARD_LEVEL_BONUS,
    REWARD_STAFF_BONUS,
    REWARD_STREAK_BONUS,
    REWARD_BOOSTER_BONUS,
    REWARD_SERVER_TAG_BONUS,
    REWARD_INVITE_BONUS,
    REWARD_REFERRAL_BONUS,
} from "@constants";
import type { RewardBonusBreakdown, RewardBonusInputs } from "./reward-bonus-types";

/** Rounds to whole basis points and clamps to `[0, maxBp]`. Never negative, never above its cap. */
function clampBp(value: number, maxBp: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(Math.round(value), maxBp);
}

/**
 * The level bonus, derived entirely from whichever levels are currently configured on the
 * existing `LevelReward` roles (`/level-rewards`) — there is no hardcoded reference level.
 *
 * Each configured level's own bonus is proportional to how it sits relative to the *highest*
 * currently configured level, so that level always resolves to exactly `maxBp`: with points at
 * levels 5 and 50, level 50 is the highest and is worth the full bonus, and level 5 is worth
 * `5/50` of it. Adding a new, higher level (say 100) makes *that* the new highest — 50 then sits
 * at `50/100` of the maximum instead, with no migration and nothing stored per member: the next
 * read simply sees the new configuration.
 *
 * A member's actual level is piecewise-linearly interpolated between the two configured levels it
 * falls between, using each node's bonus computed as above:
 *
 * `bonus = bonusA + ((level - levelA) / (levelB - levelA)) × (bonusB - bonusA)`
 *
 * Below the lowest configured level, or above the highest, the bonus is flat at that endpoint's
 * value — never extrapolated beyond the configured range.
 */
export function levelBonusBp(level: number, configuredLevelPoints: readonly number[]): number {
    const points = [...new Set(configuredLevelPoints.filter(point => Number.isFinite(point) && point > 0))]
        .sort((a, b) => a - b);

    if (points.length === 0 || !Number.isFinite(level)) return 0;

    const highest = points[points.length - 1]!;
    const nodeBp = (point: number) => clampBp((point / highest) * REWARD_LEVEL_BONUS.maxBp, REWARD_LEVEL_BONUS.maxBp);

    if (level <= points[0]!) return nodeBp(points[0]!);
    if (level >= highest) return nodeBp(highest);

    for (let i = 0; i < points.length - 1; i++) {
        const levelA = points[i]!;
        const levelB = points[i + 1]!;
        if (level < levelA || level > levelB) continue;

        const bonusA = nodeBp(levelA);
        const bonusB = nodeBp(levelB);
        if (levelB === levelA) return bonusA;

        const interpolated = bonusA + ((level - levelA) / (levelB - levelA)) * (bonusB - bonusA);
        return clampBp(interpolated, REWARD_LEVEL_BONUS.maxBp);
    }

    return nodeBp(highest);
}

/** `perDayBp` per consecutive day, capped at `maxDays` worth. */
export function streakBonusBp(days: number): number {
    if (!Number.isFinite(days) || days <= 0) return 0;
    const capped = Math.min(days, REWARD_STREAK_BONUS.maxDays);
    return clampBp(capped * REWARD_STREAK_BONUS.perDayBp, REWARD_STREAK_BONUS.maxBp);
}

/**
 * Progress toward the maximum, where "progress" is how far the member's *current* continuous
 * boosting streak is into the number of days their *current* boost count needs to reach the cap:
 * `min(continuousDays / daysToMax(boosts), 1) × maxBp`, floored once to whole basis points.
 *
 * Both inputs are read fresh every call — nothing here remembers a better bonus the member used to
 * have, so losing boosts (fewer boosts, or the continuous duration resetting) recalculates down
 * immediately rather than preserving an old high value.
 */
export function boosterBonusBp(boosts: number, continuousDays: number): number {
    if (!Number.isFinite(boosts) || boosts < 1) return 0;
    if (!Number.isFinite(continuousDays) || continuousDays <= 0) return 0;

    // Floored, not rounded: partial progress never rounds up into the maximum before its required day.
    const days = boosterDaysToMax(boosts);
    return clampBp(Math.floor((Math.min(continuousDays, days) * REWARD_BOOSTER_BONUS.maxBp) / days), REWARD_BOOSTER_BONUS.maxBp);
}

/** Continuous days `boosts` active boosts need to reach the Booster maximum. Counts past the table's end use its last row. */
export function boosterDaysToMax(boosts: number): number {
    const table = REWARD_BOOSTER_BONUS.daysForBoostCount;
    return ([...table].reverse().find(row => boosts >= row.boosts) ?? table[0]!).days;
}

/** Not staff (score 0 or absent) multiplies by exactly ×1 — consumers multiply, they never branch. */
export function staffMultiplierBp(score: number | undefined): number {
    if (!score || score <= 0) return BP_SCALE;

    const capped = Math.min(Math.max(score, 0), 100);
    const span = REWARD_STAFF_BONUS.maxMultiplierBp - REWARD_STAFF_BONUS.minMultiplierBp;

    return Math.round(REWARD_STAFF_BONUS.minMultiplierBp + (capped / 100) * span);
}

export function serverTagBonusBp(hasServerTag: boolean): number {
    return hasServerTag ? REWARD_SERVER_TAG_BONUS.flatBp : 0;
}

export function inviteBonusBp(activeSlots: number): number {
    if (!Number.isFinite(activeSlots) || activeSlots <= 0) return 0;
    const capped = Math.min(activeSlots, REWARD_INVITE_BONUS.maxActiveSlots);
    return clampBp(capped * REWARD_INVITE_BONUS.perInviteBp, REWARD_INVITE_BONUS.maxBp);
}

export function referralBonusBp(qualifiedReferrals: number): number {
    if (!Number.isFinite(qualifiedReferrals) || qualifiedReferrals <= 0) return 0;
    return clampBp(qualifiedReferrals * REWARD_REFERRAL_BONUS.perReferralBp, REWARD_REFERRAL_BONUS.maxBp);
}

/** Resolves every bonus field to its clamped basis-point value. Pure — no database, no gateway. */
export function calculateBonusBreakdown(inputs: RewardBonusInputs): RewardBonusBreakdown {
    return {
        staffMultiplierBp: staffMultiplierBp(inputs.staffScore),
        levelBp: levelBonusBp(inputs.level ?? 0, inputs.configuredLevelPoints ?? []),
        streakBp: streakBonusBp(inputs.streakDays ?? 0),
        boosterBp: boosterBonusBp(inputs.boosterCount ?? 0, inputs.boosterContinuousDays ?? 0),
        serverTagBp: serverTagBonusBp(Boolean(inputs.hasServerTag)),
        inviteBp: inviteBonusBp(inputs.activeInviteSlots ?? 0),
        referralBp: referralBonusBp(inputs.qualifiedReferrals ?? 0),
    };
}

export interface RewardCalculation {
    base: number;
    staffMultiplierBp: number;
    /** Every additive bonus, individually clamped — the same values `totalBonusBp` was summed from. */
    bonuses: Omit<RewardBonusBreakdown, "staffMultiplierBp">;
    totalBonusBp: number;
    final: number;
}

/**
 * The reward formula: `Final = Base × StaffMultiplier × (1 + TotalAdditiveBonuses)`.
 *
 * Staff is the one multiplicative term; every other bonus is additive, and each was already
 * clamped to its own maximum by `calculateBonusBreakdown`. Everything is basis points (integers),
 * and the only division happens once, at the very end, so the result is deterministic and never
 * drifts from repeated floating-point percent math.
 */
export function calculateReward(base: number, breakdown: RewardBonusBreakdown): RewardCalculation {
    const safeBase = Number.isFinite(base) && base > 0 ? Math.floor(base) : 0;

    const { staffMultiplierBp, ...bonuses } = breakdown;
    const totalBonusBp = Object.values(bonuses).reduce((sum, bp) => sum + Math.max(0, bp), 0);
    const staffBp = Number.isFinite(staffMultiplierBp) && staffMultiplierBp > 0 ? staffMultiplierBp : BP_SCALE;

    const final = safeBase === 0
        ? 0
        : Math.round((safeBase * staffBp * (BP_SCALE + totalBonusBp)) / (BP_SCALE * BP_SCALE));

    return { base: safeBase, staffMultiplierBp: staffBp, bonuses, totalBonusBp, final };
}
