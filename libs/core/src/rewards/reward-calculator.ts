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
import {
    hasAnyRequirement,
    levelRequirementSize,
    qualifiesForLevelReward,
    type LevelRequirement,
    type MemberLevels,
} from "../xp/level-split";

/** Rounds to whole basis points and clamps to `[0, maxBp]`. Never negative, never above its cap. */
function clampBp(value: number, maxBp: number): number {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.min(Math.round(value), maxBp);
}

/**
 * The level bonus, derived from the level-reward roles configured with `/level-rewards` — each a
 * message level, a voice level, or both. There is no hardcoded reference level.
 *
 * Roles are ranked by how hard they are to earn (`levelRequirementSize`: their required levels
 * added together). The hardest configured role is worth exactly `maxBp`; every other role is worth
 * its size in proportion to it. A member's bonus is the value of the best role they currently
 * qualify for — meeting every level it requires — and +0% before they qualify for any.
 *
 * With "message 10" and "message 10 + voice 5" configured, the second (15) is worth +50% and the
 * first (10) +33.33%. Configuring a harder role re-ranks everything on the next read; nothing is
 * stored per member.
 */
export function levelBonusBp(levels: MemberLevels, levelRewards: readonly LevelRequirement[]): number {
    const valid = levelRewards.filter(hasAnyRequirement);
    if (valid.length === 0) return 0;

    const hardest = Math.max(...valid.map(levelRequirementSize));
    const best = Math.max(0, ...valid.filter(req => qualifiesForLevelReward(req, levels)).map(levelRequirementSize));
    if (hardest <= 0 || best <= 0) return 0;

    return clampBp((best / hardest) * REWARD_LEVEL_BONUS.maxBp, REWARD_LEVEL_BONUS.maxBp);
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

/**
 * A referral code's configured bonus, clamped to `[0, maxBp]`. The cap is enforced here, at read
 * time, so no stored configuration — however it got there — can resolve above +15%.
 */
export function referralBonusBp(configuredBp: number): number {
    return clampBp(configuredBp, REWARD_REFERRAL_BONUS.maxBp);
}

/** Resolves every bonus field to its clamped basis-point value. Pure — no database, no gateway. */
export function calculateBonusBreakdown(inputs: RewardBonusInputs): RewardBonusBreakdown {
    return {
        staffMultiplierBp: staffMultiplierBp(inputs.staffScore),
        levelBp: levelBonusBp(
            { messageLevel: inputs.messageLevel ?? 0, voiceLevel: inputs.voiceLevel ?? 0 },
            inputs.levelRewards ?? [],
        ),
        streakBp: streakBonusBp(inputs.streakDays ?? 0),
        boosterBp: boosterBonusBp(inputs.boosterCount ?? 0, inputs.boosterContinuousDays ?? 0),
        serverTagBp: serverTagBonusBp(Boolean(inputs.hasServerTag)),
        inviteBp: inviteBonusBp(inputs.activeInviteSlots ?? 0),
        referralBp: referralBonusBp(inputs.referralCodeBp ?? 0),
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
