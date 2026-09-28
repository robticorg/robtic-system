/** Verifies the pure reward calculator, the dynamic level/streak/server-tag/booster/invite bonuses, and the message/voice reward sources — no database, no gateway. */
import {
    calculateReward,
    calculateBonusBreakdown,
    boosterBonusBp,
    levelBonusBp,
    streakBonusBp,
    serverTagBonusBp,
    isServerTagActive,
    decideServerTagPresence,
    reachedActivityRewardTiers,
    dailyActivityRewardIdempotencyKey,
    boosterDaysToMax,
    inviteBonusBp,
    continuousDaysSince,
    effectiveBoostCount,
    applyPremiumSince,
    applyBoostAnnouncement,
    reconcileBoostCounts,
    planGuildBoosterSync,
    inviteExpiresAt,
    isInviteCreditActive,
    countActiveInviteCredits,
    decideInviteCredit,
    detectUsedInvite,
    recordInviteeJoin,
    recordInviteeLeave,
    type RewardBonusInputs,
    type ActivityRewardTier,
    type BoosterStateSnapshot,
    type InviteUseSnapshot,
    type InviteCreditStore,
} from "@core/rewards";
import { BP_SCALE, REWARD_LEVEL_BONUS, REWARD_STREAK_BONUS, REWARD_BOOSTER_BONUS, REWARD_SERVER_TAG_BONUS, REWARD_INVITE_BONUS, REWARD_BASE_VALUES } from "@constants";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const reward = (base: number, inputs: RewardBonusInputs) => calculateReward(base, calculateBonusBreakdown(inputs));

/** A representative guild configuration for the existing cases below: two `/level-rewards` roles, at 50 and 99. */
const LEVEL_POINTS = [50, 99] as const;

// ============================================================================
// REWARD CALCULATOR
// ============================================================================

// 1. Normal user — no bonuses at all.
{
    const r = reward(100, {});
    check("1. normal user: final equals base, staff neutral", r.final === 100 && r.staffMultiplierBp === BP_SCALE, `final=${r.final}`);
}

// 2. Level bonus only (level 49 — below the lowest configured role, flat at its bonus).
{
    const r = reward(100, { level: 49, configuredLevelPoints: LEVEL_POINTS });
    check("2. level bonus only: no staff multiplier applied", r.staffMultiplierBp === BP_SCALE);
    check("2. level bonus only: bonus scales with configured levels, capped below max", r.totalBonusBp > 0 && r.totalBonusBp < REWARD_LEVEL_BONUS.maxBp);
    check("2. level bonus only: reward exceeds base", r.final > 100, `final=${r.final}`);
}

// 3. Staff only (mid-ladder score).
{
    const r = reward(100, { staffScore: 50 });
    check("3. staff only: bonuses stay at zero", r.totalBonusBp === 0);
    check("3. staff only: staff multiplies, e.g. ×1.5", r.staffMultiplierBp === 15_000, `staffBp=${r.staffMultiplierBp}`);
    check("3. staff only: reward is base × multiplier", r.final === 150, `final=${r.final}`);
}

// 4. Level + Staff, both moderate.
{
    const r = reward(100, { level: 49, configuredLevelPoints: LEVEL_POINTS, staffScore: 50 });
    check("4. level+staff: staff still multiplies", r.staffMultiplierBp === 15_000);
    check("4. level+staff: level still adds", r.totalBonusBp > 0);
    check(
        "4. level+staff: final matches base × staff × (1+bonus) exactly",
        r.final === Math.round((100 * r.staffMultiplierBp * (BP_SCALE + r.totalBonusBp)) / (BP_SCALE * BP_SCALE))
    );
}

// 5. Maximum level (the highest configured role) + maximum staff.
{
    const r = reward(100, { level: 99, configuredLevelPoints: LEVEL_POINTS, staffScore: 100 });
    check("5. max level + max staff: staff caps at ×1.6", r.staffMultiplierBp === 16_000);
    check("5. max level + max staff: level bonus caps at +50%", r.totalBonusBp === 5_000);
    check("5. max level + max staff: 100 × 1.6 × 1.5 = 240", r.final === 240, `final=${r.final}`);
}

// 6. Maximum bonuses + maximum staff — the spec's worked example (level 50% + streak 10% + booster 15% = +75%, staff ×1.6 → ×2.8).
{
    const r = reward(100, {
        level: 99, configuredLevelPoints: LEVEL_POINTS, staffScore: 100,
        streakDays: 100, boosterCount: 6, boosterContinuousDays: 5,
    });
    check("6. max bonuses: total is exactly +75%", r.totalBonusBp === 7_500, `totalBonusBp=${r.totalBonusBp}`);
    check("6. max bonuses: staff is exactly ×1.6", r.staffMultiplierBp === 16_000);
    check("6. worked example: 100 × 1.6 × 1.75 = 280", r.final === 280, `final=${r.final}`);
}

// 7. No bonuses, base only.
{
    const r = reward(50, {});
    check("7. no bonuses: final equals base", r.final === 50, `final=${r.final}`);
}

// 8. Zero / invalid values.
{
    check("8. zero base yields zero reward", reward(0, { level: 99, configuredLevelPoints: LEVEL_POINTS, staffScore: 100 }).final === 0);
    check("8. negative base yields zero reward", reward(-10, { level: 99, configuredLevelPoints: LEVEL_POINTS }).final === 0);
    check("8. NaN level contributes no bonus", calculateBonusBreakdown({ level: Number.NaN, configuredLevelPoints: LEVEL_POINTS }).levelBp === 0);
    check("8. negative streak contributes no bonus", calculateBonusBreakdown({ streakDays: -5 }).streakBp === 0);
}

// 9. Booster bonus after losing boosts — never preserves the old higher bonus.
{
    const atSix = boosterBonusBp(6, 5); // meets the 6-boost/5-day requirement exactly → max
    check("9. 6 boosts held 5 days reaches the booster max", atSix === REWARD_BOOSTER_BONUS.maxBp, `bp=${atSix}`);

    const afterLosingBoosts = boosterBonusBp(1, 5); // same 5 continuous days, but only 1 boost now
    check(
        "9. losing boosts recalculates from the current count, not the old bonus",
        afterLosingBoosts < atSix,
        `before=${atSix} after=${afterLosingBoosts}`
    );

    check("9. no boosts held: no bonus regardless of past duration", boosterBonusBp(0, 5) === 0);
}

// Bonuses never exceed their configured maximum, even with absurd inputs.
{
    const b = calculateBonusBreakdown({
        level: 99_999,
        configuredLevelPoints: LEVEL_POINTS,
        streakDays: 99_999,
        boosterCount: 999,
        boosterContinuousDays: 999_999,
        hasServerTag: true,
        activeInviteSlots: 999,
        qualifiedReferrals: 999,
        premiumBonusPercent: 999,
    });
    check("bonuses clamp to their configured maximums under extreme input", [b.levelBp, b.streakBp, b.boosterBp].every(v => v > 0));
    check("level bonus never exceeds its max", b.levelBp === REWARD_LEVEL_BONUS.maxBp, `${b.levelBp}`);
    check("streak bonus never exceeds its max", b.streakBp === REWARD_STREAK_BONUS.maxBp, `${b.streakBp}`);
    check("booster bonus never exceeds its max", b.boosterBp === REWARD_BOOSTER_BONUS.maxBp, `${b.boosterBp}`);
}

// Determinism: identical inputs always produce an identical result, with no floating-point drift.
{
    const inputs: RewardBonusInputs = { level: 42, configuredLevelPoints: LEVEL_POINTS, staffScore: 63, streakDays: 17, boosterCount: 2, boosterContinuousDays: 20 };
    const a = reward(777, inputs);
    const b = reward(777, inputs);
    check("final reward is deterministic across repeated calculation", JSON.stringify(a) === JSON.stringify(b));
    check("final reward is a whole number (no fractional Credits)", Number.isInteger(a.final));
}

// ============================================================================
// DYNAMIC LEVEL BONUS — derived from the existing `/level-rewards` configuration,
// never a hardcoded reference level.
// ============================================================================

// No configuration at all → no bonus, for any level.
{
    check("no configured level rewards: no bonus at level 1", levelBonusBp(1, []) === 0);
    check("no configured level rewards: no bonus at level 1000", levelBonusBp(1000, []) === 0);
}

// One configured level reward — the single point is simultaneously the lowest and the highest, so
// it always resolves to the full maximum, for every level.
{
    check("one configured level reward: below it still gets the max", levelBonusBp(0, [50]) === REWARD_LEVEL_BONUS.maxBp);
    check("one configured level reward: exactly on it gets the max", levelBonusBp(50, [50]) === REWARD_LEVEL_BONUS.maxBp);
    check("one configured level reward: above it still gets the max", levelBonusBp(500, [50]) === REWARD_LEVEL_BONUS.maxBp);
}

// Two configured level rewards — the worked example from the spec: 5 → +5%, 50 → +50%.
{
    check("two points: the lowest configured level is +5%", levelBonusBp(5, [5, 50]) === 500, `${levelBonusBp(5, [5, 50])}`);
    check("two points: the highest configured level is the max (+50%)", levelBonusBp(50, [5, 50]) === REWARD_LEVEL_BONUS.maxBp);
    check("two points: below the first configured level uses its bonus", levelBonusBp(1, [5, 50]) === 500);
    check("two points: above the highest configured level uses its bonus", levelBonusBp(9999, [5, 50]) === REWARD_LEVEL_BONUS.maxBp);
    check("two points: exactly on a configured level matches it", levelBonusBp(5, [5, 50]) === 500 && levelBonusBp(50, [5, 50]) === 5000);
    check("two points: between them interpolates linearly — level 27 is +27%", levelBonusBp(27, [5, 50]) === 2700, `${levelBonusBp(27, [5, 50])}`);
}

// Three configured level rewards — adding a higher role changes the whole curve, automatically,
// with nothing stored per member: level 50 goes from +50% (when it was the highest) to +25% (once
// 100 is configured and becomes the new highest).
{
    const twoPoints = levelBonusBp(50, [5, 50]);
    const threePoints = levelBonusBp(50, [5, 50, 100]);

    check("three points: level 50 was the max with two points", twoPoints === 5_000, `${twoPoints}`);
    check("three points: adding level 100 changes level 50's bonus automatically", threePoints === 2_500, `${threePoints}`);
    check("three points: the new highest (100) is the max", levelBonusBp(100, [5, 50, 100]) === REWARD_LEVEL_BONUS.maxBp);
    check("three points: adding a level changed the interpolation, not just the endpoint", threePoints < twoPoints);
}

// Level below the first configured point, exactly on a configured level, between two configured
// points, and above the highest — each named explicitly, per the spec's test list.
{
    const points = [10, 40, 80];
    check("below the first configured point: flat at its bonus", levelBonusBp(3, points) === levelBonusBp(10, points));
    check("exactly on a configured level: matches it exactly", levelBonusBp(40, points) === Math.round((40 / 80) * REWARD_LEVEL_BONUS.maxBp));
    check(
        "between two configured points: strictly between their bonuses",
        levelBonusBp(60, points) > levelBonusBp(40, points) && levelBonusBp(60, points) < levelBonusBp(80, points)
    );
    check("above the highest configured point: flat at the max", levelBonusBp(999, points) === REWARD_LEVEL_BONUS.maxBp);
}

// Configuration with arbitrary (non-round, unsorted, duplicated) levels — order and duplicates in
// the input must not matter, since the existing repository always returns them, but sorting must
// not be assumed by the caller.
{
    const arbitrary = [88, 3, 17, 42, 17, 3];
    const sorted = [3, 17, 42, 88];
    check(
        "arbitrary/unsorted/duplicated input matches the sorted, deduplicated equivalent",
        levelBonusBp(30, arbitrary) === levelBonusBp(30, sorted)
    );
    check("arbitrary configuration stays monotonic across levels", levelBonusBp(3, sorted) <= levelBonusBp(17, sorted) && levelBonusBp(17, sorted) <= levelBonusBp(42, sorted) && levelBonusBp(42, sorted) <= levelBonusBp(88, sorted));
}

// The maximum is always +50%, and there is no hardcoded reference level (99, 90, 100 or otherwise)
// — an arbitrarily large configured level still resolves to exactly the max at that level.
{
    check("max level bonus is never exceeded, even far past any historically hardcoded ceiling", levelBonusBp(500, [5, 50, 250]) <= REWARD_LEVEL_BONUS.maxBp);
    check("no hardcoded level 99: a config topping out at 30 still reaches the max at 30", levelBonusBp(30, [5, 30]) === REWARD_LEVEL_BONUS.maxBp);
    check("no hardcoded level 90/100: a config topping out at 500 only reaches the max at 500", levelBonusBp(99, [5, 500]) < REWARD_LEVEL_BONUS.maxBp);
    check(`REWARD_LEVEL_BONUS carries no maxLevel constant`, !("maxLevel" in REWARD_LEVEL_BONUS));
}

// Integer/basis-point safety and determinism.
{
    const a = levelBonusBp(37, [5, 12, 61, 88]);
    const b = levelBonusBp(37, [5, 12, 61, 88]);
    check("level bonus is always a whole number of basis points", Number.isInteger(a));
    check("level bonus is deterministic across repeated calculation", a === b);
}

// ============================================================================
// STREAK BONUS — reuses the existing Streak system's `currentStreak` directly; no second tracker.
// ============================================================================

{
    check("streak: 0 days is +0%", streakBonusBp(0) === 0);
    check("streak: 1 day is +0.1%", streakBonusBp(1) === 10, `${streakBonusBp(1)}`);
    check("streak: 10 days is +1%", streakBonusBp(10) === 100, `${streakBonusBp(10)}`);
    check("streak: 25 days is +2.5%", streakBonusBp(25) === 250, `${streakBonusBp(25)}`);
    check("streak: 50 days is +5%", streakBonusBp(50) === 500, `${streakBonusBp(50)}`);
    check("streak: 75 days is +7.5%", streakBonusBp(75) === 750, `${streakBonusBp(75)}`);
    check("streak: 100 days is +10%", streakBonusBp(100) === REWARD_STREAK_BONUS.maxBp);
    check("streak: 150 days is still capped at +10%", streakBonusBp(150) === REWARD_STREAK_BONUS.maxBp);
    check("streak: maximum is never exceeded, even at absurd day counts", streakBonusBp(999_999) === REWARD_STREAK_BONUS.maxBp);
    check("streak: negative days contribute no bonus", streakBonusBp(-5) === 0);
    check("streak: value is always a whole number of basis points", Number.isInteger(streakBonusBp(37)));
    check("streak: deterministic across repeated calculation", streakBonusBp(42) === streakBonusBp(42));
}

// ============================================================================
// SERVER TAG BONUS — dynamic, evaluated fresh every call; nothing is stored on the member.
// ============================================================================

{
    // The bonus itself: a flat +10% while active, +0% otherwise, never anything else.
    check("server tag: inactive is +0%", serverTagBonusBp(false) === 0);
    check("server tag: active is +10%", serverTagBonusBp(true) === REWARD_SERVER_TAG_BONUS.flatBp, `${serverTagBonusBp(true)}`);
    check("server tag: bonus never exceeds +10%", serverTagBonusBp(true) <= REWARD_SERVER_TAG_BONUS.flatBp);

    // Dynamic behavior: the same member, evaluated twice, with nothing remembered between calls —
    // disabling the tag removes the bonus on the very next read, and re-enabling it reapplies
    // immediately. There is no stored value to go stale.
    const whileActive = calculateBonusBreakdown({ hasServerTag: true }).serverTagBp;
    const afterDisabling = calculateBonusBreakdown({ hasServerTag: false }).serverTagBp;
    const afterReenabling = calculateBonusBreakdown({ hasServerTag: true }).serverTagBp;
    check("server tag: disabling the tag removes the bonus", whileActive === REWARD_SERVER_TAG_BONUS.flatBp && afterDisabling === 0);
    check("server tag: re-enabling the tag reapplies the bonus", afterReenabling === REWARD_SERVER_TAG_BONUS.flatBp);

    // isServerTagActive: the live-Discord-state decision the bot layer feeds into the resolver.
    const guildId = "guild-1";
    check("server tag detection: no primary guild at all is inactive", isServerTagActive(null, guildId) === false);
    check("server tag detection: identity disabled is inactive even with a matching guild id", isServerTagActive({ identityEnabled: false, identityGuildId: guildId }, guildId) === false);
    check("server tag detection: identity enabled for a different guild is inactive", isServerTagActive({ identityEnabled: true, identityGuildId: "some-other-guild" }, guildId) === false);
    check("server tag detection: identity enabled and matching this guild is active", isServerTagActive({ identityEnabled: true, identityGuildId: guildId }, guildId) === true);
}

// ============================================================================
// SERVER TAG PRESENCE — the 6-continuous-hour anti-abuse rule (`decideServerTagPresence`).
// Enabling the tag right before a claim must not grant the bonus; only genuinely wearing it for
// the required window does. Storage is scoped per UTC day, so `storedActiveSince: null` below
// stands in for both "never seen today" and "a new day" — the timer restarts identically either way.
// ============================================================================

{
    const HOUR = 3_600_000;
    const now = new Date("2026-01-01T12:00:00.000Z");
    const minHours = REWARD_SERVER_TAG_BONUS.minContinuousHours;

    // Inactive right now is never eligible, no matter what was stored.
    const inactiveNoHistory = decideServerTagPresence(false, null, now);
    const inactiveWithHistory = decideServerTagPresence(false, new Date(now.getTime() - 10 * HOUR), now);
    check("presence: inactive now is never eligible (no history)", inactiveNoHistory.eligible === false && inactiveNoHistory.nextActiveSince === null);
    check("presence: inactive now clears any prior history", inactiveWithHistory.eligible === false && inactiveWithHistory.nextActiveSince === null);

    // First time observed active today (nothing stored yet, or a fresh day) — the window starts
    // now and is not satisfied yet. This is the exact abuse case: enable and immediately claim.
    const firstSeen = decideServerTagPresence(true, null, now);
    check("presence: enabling right before a claim is not eligible", firstSeen.eligible === false);
    check("presence: the window starts at the moment first observed active", firstSeen.nextActiveSince?.getTime() === now.getTime());

    // Just short of the window, exactly on it, and comfortably past it.
    const justShort = decideServerTagPresence(true, new Date(now.getTime() - (minHours * HOUR - 60_000)), now);
    const exactlyOn = decideServerTagPresence(true, new Date(now.getTime() - minHours * HOUR), now);
    const wellPast = decideServerTagPresence(true, new Date(now.getTime() - (minHours + 4) * HOUR), now);
    check(`presence: ${minHours}h minus a minute is not yet eligible`, justShort.eligible === false);
    check(`presence: exactly ${minHours}h is eligible`, exactlyOn.eligible === true);
    check("presence: comfortably past the window is eligible", wellPast.eligible === true);

    // Once eligible (or not), the stored timestamp itself is carried through unchanged — a later
    // check must not move the start of the window forward or backward.
    const since = new Date(now.getTime() - (minHours + 1) * HOUR);
    check("presence: an existing timestamp is preserved, not rewritten", decideServerTagPresence(true, since, now).nextActiveSince?.getTime() === since.getTime());

    // The full remove-then-re-enable story, in sequence: active (day starts, not yet eligible) →
    // removed before claiming (cleared, no bonus — matches "never get his bonus") → re-enabled
    // later the same day (a fresh window, not a resumption of the old one).
    const t0 = now;
    const enabled = decideServerTagPresence(true, null, t0);
    check("story: enabling starts a fresh window", enabled.eligible === false);

    const removedBeforeClaiming = decideServerTagPresence(false, enabled.nextActiveSince, new Date(t0.getTime() + 2 * HOUR));
    check("story: removing it before claiming yields no bonus and clears the window", removedBeforeClaiming.eligible === false && removedBeforeClaiming.nextActiveSince === null);

    const reEnabledLater = decideServerTagPresence(true, removedBeforeClaiming.nextActiveSince, new Date(t0.getTime() + 3 * HOUR));
    check("story: re-enabling after removal restarts the window rather than resuming it", reEnabledLater.eligible === false && reEnabledLater.nextActiveSince?.getTime() === t0.getTime() + 3 * HOUR);

    const claimedAfterFullWindow = decideServerTagPresence(true, reEnabledLater.nextActiveSince, new Date(t0.getTime() + 3 * HOUR + minHours * HOUR));
    check(`story: waiting the full ${minHours}h after re-enabling finally grants it`, claimedAfterFullWindow.eligible === true);

    // Determinism and integer-safety of the decision (a boolean and a Date — no fractional state).
    check("presence: deterministic across repeated calculation", decideServerTagPresence(true, since, now).eligible === decideServerTagPresence(true, since, now).eligible);
}

// ============================================================================
// INTEGRATION — Server Tag and Streak alongside Level, Staff, and each other.
// ============================================================================

{
    // Server Tag + Streak combine additively with nothing else in play.
    const both = calculateBonusBreakdown({ hasServerTag: true, streakDays: 50 });
    check(
        "integration: server tag + streak combine additively",
        both.serverTagBp === 1_000 && both.streakBp === 500 &&
        calculateReward(100, both).totalBonusBp === 1_500
    );

    // The spec's own worked example: Base 50M, Staff ×1.4, Level +20%, Streak +5%, Server Tag +10%.
    // ×1.4 sits exactly on `staffMultiplierBp`'s floor, which is only reachable in the limit as a
    // staff score approaches 0 (score 0 itself means "not staff", i.e. neutral ×1) — so it is
    // supplied directly here, the same way a real caller's resolved breakdown would carry it. Level
    // +20% comes from the real `levelBonusBp`, via two configured points where level 4 is the lower
    // one: 4/10 of the configured maximum.
    const breakdown = {
        staffMultiplierBp: 14_000,
        levelBp: levelBonusBp(4, [4, 10]),
        streakBp: streakBonusBp(50),
        boosterBp: 0,
        serverTagBp: serverTagBonusBp(true),
        inviteBp: 0,
        referralBp: 0,
        premiumBp: 0,
    };
    check("integration: level 4 of a 4/10 configuration is exactly +20%", breakdown.levelBp === 2_000, `${breakdown.levelBp}`);
    check(
        "integration: level + streak + server tag combine to the expected total bonus (+35%)",
        breakdown.levelBp + breakdown.streakBp + breakdown.serverTagBp === 3_500,
        `${breakdown.levelBp + breakdown.streakBp + breakdown.serverTagBp}`
    );

    const worked = calculateReward(50, breakdown); // 50 internal units = "50M Credits"
    check(
        "integration: base 50M × staff ×1.4 × (1 + 0.20 + 0.05 + 0.10) rounds to 95M — 94.5 is not a whole Credits amount",
        worked.final === 95,
        `final=${worked.final}`
    );

    // Bonuses combine correctly with the staff multiplier directly (not just additive terms).
    const withStaff = reward(100, { staffScore: 50, hasServerTag: true, streakDays: 100 });
    check(
        "integration: bonuses combine correctly with the staff multiplier",
        withStaff.staffMultiplierBp === 15_000 && withStaff.totalBonusBp === 1_000 + 1_000 &&
        withStaff.final === Math.round((100 * 15_000 * (BP_SCALE + 2_000)) / (BP_SCALE * BP_SCALE))
    );

    // No duplicate application: resolving the same breakdown twice from identical inputs is
    // byte-for-byte identical — nothing accumulates across calls.
    const inputs: RewardBonusInputs = { hasServerTag: true, streakDays: 30, level: 20, configuredLevelPoints: [50] };
    const first = calculateBonusBreakdown(inputs);
    const second = calculateBonusBreakdown(inputs);
    check("integration: no duplicate bonus application across repeated resolution", JSON.stringify(first) === JSON.stringify(second));
}

// ============================================================================
// MESSAGE + VOICE REWARD SOURCES
// ============================================================================

const messageTiers: ActivityRewardTier[] = REWARD_BASE_VALUES.message.map(t => ({ threshold: t.dailyMessages, units: t.units }));
const voiceTiers: ActivityRewardTier[] = REWARD_BASE_VALUES.voice.map(t => ({ threshold: t.dailySeconds, units: t.units }));

// MESSAGE
{
    check("message: below 300 daily messages is not claimable", reachedActivityRewardTiers(299, messageTiers).length === 0);
    check(
        "message: 300 daily messages claims exactly the 5M-unit tier",
        reachedActivityRewardTiers(300, messageTiers).length === 1 && reachedActivityRewardTiers(300, messageTiers)[0]!.units === 5
    );
    const at600 = reachedActivityRewardTiers(600, messageTiers);
    check("message: 600 daily messages claims both the 300 and the 600 tier", at600.length === 2 && at600[1]!.units === 50);

    const key1 = dailyActivityRewardIdempotencyKey("message", "guild1", "user1", "2026-01-01", 300);
    const key2 = dailyActivityRewardIdempotencyKey("message", "guild1", "user1", "2026-01-01", 300);
    const keyNextDay = dailyActivityRewardIdempotencyKey("message", "guild1", "user1", "2026-01-02", 300);
    check("message: duplicate claim same day produces the same idempotency key (rejected on replay)", key1 === key2);
    check("message: a new day produces a different idempotency key (claimable again)", key1 !== keyNextDay);

    const calc = calculateReward(5, calculateBonusBreakdown({ staffScore: 100 }));
    check("message: the calculator applies bonuses on top of the base tier reward", calc.final === 8, `final=${calc.final}`);
}

// VOICE
{
    const fourHours59 = 4 * 3600 + 59 * 60;
    const fiveHours = 5 * 3600;
    check("voice: below 5 hours is not claimable", reachedActivityRewardTiers(fourHours59, voiceTiers).length === 0);
    check(
        "voice: exactly 5 hours claims the 5M-unit tier",
        reachedActivityRewardTiers(fiveHours, voiceTiers).length === 1 && reachedActivityRewardTiers(fiveHours, voiceTiers)[0]!.units === 5
    );

    const key1 = dailyActivityRewardIdempotencyKey("voice", "guild1", "user1", "2026-01-01", fiveHours);
    const key2 = dailyActivityRewardIdempotencyKey("voice", "guild1", "user1", "2026-01-01", fiveHours);
    check("voice: duplicate claim same day produces the same idempotency key (rejected on replay)", key1 === key2);

    const calc = calculateReward(5, calculateBonusBreakdown({ streakDays: 100 })); // +10% streak: 5 × 1.10 = 5.5 → 6
    check("voice: the calculator applies bonuses on top of the base tier reward", calc.final === 6, `final=${calc.final}`);
}

// Message and voice idempotency keys never collide with each other, even for the same threshold.
{
    const messageKey = dailyActivityRewardIdempotencyKey("message", "guild1", "user1", "2026-01-01", 18000);
    const voiceKey = dailyActivityRewardIdempotencyKey("voice", "guild1", "user1", "2026-01-01", 18000);
    check("message and voice idempotency keys never collide", messageKey !== voiceKey);
}

// ============================================================================
// BOOSTER BONUS — the curve. `boosterBonusBp(boosts, continuousDays)` is a pure function of the
// member's *current* count and *current* continuous duration; nothing is ever stored as a percent.
// ============================================================================

{
    check("booster: 0 boosts is +0%", boosterBonusBp(0, 30) === 0);
    check("booster: 1 boost, day 1 is +0.25%", boosterBonusBp(1, 1) === 25, `${boosterBonusBp(1, 1)}`);
    check("booster: 1 boost, day 10 is +2.5%", boosterBonusBp(1, 10) === 250, `${boosterBonusBp(1, 10)}`);
    check("booster: 1 boost, day 30 is +7.5%", boosterBonusBp(1, 30) === 750, `${boosterBonusBp(1, 30)}`);
    check("booster: 1 boost, day 60 is +15%", boosterBonusBp(1, 60) === 1_500);
    check("booster: 1 boost, day 100 stays +15%", boosterBonusBp(1, 100) === 1_500);

    const progression: Array<[number, number]> = [[1, 60], [2, 45], [3, 30], [4, 15], [5, 10], [6, 5]];
    for (const [boosts, days] of progression) {
        check(`booster: ${boosts} boost(s) need exactly ${days} days`, boosterDaysToMax(boosts) === days);
        check(`booster: ${boosts} boost(s) reach +15% on day ${days}`, boosterBonusBp(boosts, days) === 1_500);
        check(`booster: ${boosts} boost(s) are at +7.5% halfway (day ${days / 2})`, boosterBonusBp(boosts, days / 2) === 750, `${boosterBonusBp(boosts, days / 2)}`);
        check(`booster: ${boosts} boost(s) are below max just before day ${days}`, boosterBonusBp(boosts, days - 0.01) < 1_500);
    }

    const sixBoostDays = [1, 2, 3, 4, 5].map(day => boosterBonusBp(6, day));
    check("booster: 6 boosts go +3/+6/+9/+12/+15% over days 1-5", JSON.stringify(sixBoostDays) === JSON.stringify([300, 600, 900, 1_200, 1_500]), `${sixBoostDays}`);
    check("booster: 10 boosts use the 6-boost progression", [1, 2.5, 5, 50].every(day => boosterBonusBp(10, day) === boosterBonusBp(6, day)));
    check("booster: 10 boosts need 5 days", boosterDaysToMax(10) === 5);

    // The headline rule: a count change recalculates from the *current* count, never keeps the old bonus.
    check("booster: 6 boosts held 5 days is +15%", boosterBonusBp(6, 5) === 1_500);
    check("booster: dropping to 1 boost with the same 5 days is +1.25%", boosterBonusBp(1, 5) === 125, `${boosterBonusBp(1, 5)}`);

    check("booster: never exceeds +15% (absurd inputs)", boosterBonusBp(999, 999_999) === REWARD_BOOSTER_BONUS.maxBp);
    check("booster: negative duration gives +0%", boosterBonusBp(3, -10) === 0);
    check("booster: negative count gives +0%", boosterBonusBp(-2, 10) === 0);
    check("booster: NaN inputs give +0%", boosterBonusBp(Number.NaN, 10) === 0 && boosterBonusBp(2, Number.NaN) === 0);

    let allIntegers = true;
    for (let boosts = 1; boosts <= 8; boosts++) {
        for (let day = 0; day <= 70; day += 0.37) {
            const bp = boosterBonusBp(boosts, day);
            if (!Number.isInteger(bp) || bp < 0 || bp > REWARD_BOOSTER_BONUS.maxBp) allIntegers = false;
        }
    }
    check("booster: always a whole number of basis points within [0, max]", allIntegers);
}

// ============================================================================
// BOOSTER STATE — transitions from Discord's signals (premiumSince, boost announcements, the
// guild's total), each a pure function over the stored snapshot.
// ============================================================================

{
    const DAY = 86_400_000;
    const now = new Date("2026-06-01T12:00:00.000Z");
    const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);
    const progress = (state: BoosterStateSnapshot | null) =>
        boosterBonusBp(effectiveBoostCount(state), state ? continuousDaysSince(state.continuousStartedAt, now) : 0);

    // Starting: no stored state + Discord says boosting → a new period, counted as one boost.
    const started = applyPremiumSince(null, now, now);
    check("booster state: starting to boost creates state at premiumSince", started?.continuousStartedAt.getTime() === now.getTime());
    check("booster state: a new booster counts as 1 boost", effectiveBoostCount(started) === 1);
    check("booster state: starting today is +0% (no duration yet)", progress(started) === 0);

    // Stopping: premiumSince null → state cleared → +0%, whatever came before.
    const sixForFive: BoosterStateSnapshot = { boostCount: 6, continuousStartedAt: daysAgo(5) };
    check("booster state: 6 boosts for 5 days is +15%", progress(sixForFive) === 1_500);
    const stopped = applyPremiumSince(sixForFive, null, now);
    check("booster state: stopping clears the state", stopped === null);
    check("booster state: zero boosts is +0%", progress(stopped) === 0 && effectiveBoostCount(stopped) === 0);

    // Missing state (never boosted / never observed) resolves to zero, not an error.
    check("booster state: missing state is 0 boosts, +0%", effectiveBoostCount(null) === 0 && progress(null) === 0);

    // Increasing: announcements add to the count and keep the period's start.
    const increased = applyBoostAnnouncement({ boostCount: 1, continuousStartedAt: daysAgo(3) }, 2, daysAgo(3), now);
    check("booster state: an announcement of 2 boosts raises 1 → 3", increased.boostCount === 3);
    check("booster state: raising the count keeps the continuous start", increased.continuousStartedAt.getTime() === daysAgo(3).getTime());
    check("booster state: 3 boosts for 3 days is 3/30 of +15%", progress(increased) === 150, `${progress(increased)}`);

    const toSix = applyBoostAnnouncement({ boostCount: 5, continuousStartedAt: daysAgo(4) }, 1, daysAgo(4), now);
    check("booster state: reaching 6 boosts switches to the 5-day progression", effectiveBoostCount(toSix) === 6 && progress(toSix) === 1_200);
    check("booster state: an unparseable announcement counts as 1 boost", applyBoostAnnouncement({ boostCount: 2, continuousStartedAt: now }, Number.NaN, now, now).boostCount === 3);

    // A first boost produces both a premiumSince change and an announcement, in either order — the
    // count must come out as 1 both ways, never 2.
    const premiumFirst = applyBoostAnnouncement(applyPremiumSince(null, now, now), 1, now, now);
    const announcementFirst = applyPremiumSince(applyBoostAnnouncement(null, 1, null, now), now, now);
    check("booster state: first boost, premiumSince then announcement → 1 boost", effectiveBoostCount(premiumFirst) === 1);
    check("booster state: first boost, announcement then premiumSince → 1 boost", effectiveBoostCount(announcementFirst) === 1);

    // Decreasing: the guild total drops; with one multi-booster the drop is attributed exactly.
    const exact = reconcileBoostCounts([{ discordId: "a", boostCount: 6 }, { discordId: "b", boostCount: 1 }], 2);
    check("booster state: 6 → 1 is attributed exactly when unambiguous", exact.get("a") === 1 && !exact.has("b"));
    const afterDrop = { ...sixForFive, boostCount: exact.get("a")! };
    check("booster state: after dropping 6 → 1 with 5 continuous days, the bonus is +1.25%", progress(afterDrop) === 125, `${progress(afterDrop)}`);
    check("booster state: dropping boosts keeps the continuous start", afterDrop.continuousStartedAt.getTime() === sixForFive.continuousStartedAt.getTime());

    // Ambiguous drops never leave anyone above what they could still have.
    const ambiguous = reconcileBoostCounts([{ discordId: "a", boostCount: 4 }, { discordId: "b", boostCount: 3 }], 5);
    check("booster state: an ambiguous drop lowers every candidate to its lower bound", ambiguous.get("a") === 2 && ambiguous.get("b") === 1);
    check("booster state: no drop → no change", reconcileBoostCounts([{ discordId: "a", boostCount: 4 }], 4).size === 0);
    check("booster state: counts never go below 1 while boosting", reconcileBoostCounts([{ discordId: "a", boostCount: 3 }], 0).get("a") === 1);

    // Bot restart: nothing stored, but Discord's premiumSince says 20 days — progress is not lost.
    const afterRestart = applyPremiumSince(null, daysAgo(20), now);
    check("booster state: after a restart, duration comes from Discord's premiumSince", progress(afterRestart) === 500, `${progress(afterRestart)}`);

    // Stale state: stored from an old period, but premiumSince is newer → they stopped and
    // restarted unobserved; the old count and old start are both dropped.
    const stale = applyPremiumSince({ boostCount: 6, continuousStartedAt: daysAgo(40) }, daysAgo(2), now);
    check("booster state: a restarted period discards the stale count", effectiveBoostCount(stale) === 1);
    check("booster state: a restarted period discards the stale start", stale?.continuousStartedAt.getTime() === daysAgo(2).getTime());
    const sameInstant = applyPremiumSince({ boostCount: 3, continuousStartedAt: now }, new Date(now.getTime() + 30_000), new Date(now.getTime() + 60_000));
    check("booster state: seconds of drift between signals is the same period", sameInstant?.boostCount === 3);

    // Max stays max while the state is unchanged and continuous; no negative duration from a future timestamp.
    check("booster state: +15% holds while the state stays continuous", progress({ boostCount: 1, continuousStartedAt: daysAgo(400) }) === 1_500);
    const future = applyPremiumSince(null, new Date(now.getTime() + DAY), now);
    check("booster state: a future premiumSince is clamped to now", future?.continuousStartedAt.getTime() === now.getTime() && progress(future) === 0);
    check("booster state: continuous days are never negative", continuousDaysSince(new Date(now.getTime() + DAY), now) === 0);

    // Leave/rejoin and guild resync: tracked members who stopped or left are cleared, untracked
    // boosters are added from premiumSince, and counts are reconciled against the guild total.
    const tracked = new Map<string, BoosterStateSnapshot>([
        ["left", { boostCount: 2, continuousStartedAt: daysAgo(10) }],
        ["multi", { boostCount: 6, continuousStartedAt: daysAgo(5) }],
        ["steady", { boostCount: 0, continuousStartedAt: daysAgo(8) }],
    ]);
    const plan = planGuildBoosterSync(
        tracked,
        [{ discordId: "multi", premiumSince: daysAgo(5) }, { discordId: "steady", premiumSince: daysAgo(8) }, { discordId: "new", premiumSince: daysAgo(1) }],
        3,
        now,
    );
    check("booster resync: a member who left is cleared", plan.clear.length === 1 && plan.clear[0] === "left");
    check("booster resync: an untracked booster is added", plan.save.get("new")?.continuousStartedAt.getTime() === daysAgo(1).getTime());
    check("booster resync: the multi-booster is reconciled down to the guild total", plan.save.get("multi")?.boostCount === 1);
    check("booster resync: unchanged rows are not rewritten", !plan.save.has("steady"));
}

// ============================================================================
// INVITE BONUS — +1% per active credit, +10% max; each credit expires 7 days after its own join.
// ============================================================================

{
    check("invite: 0 active invites is +0%", inviteBonusBp(0) === 0);
    check("invite: 1 active invite is +1%", inviteBonusBp(1) === 100);
    check("invite: 5 active invites is +5%", inviteBonusBp(5) === 500);
    check("invite: 10 active invites is +10%", inviteBonusBp(10) === 1_000);
    check("invite: 11 active invites is still +10%", inviteBonusBp(11) === REWARD_INVITE_BONUS.maxBp);
    check("invite: negative / NaN counts are +0%", inviteBonusBp(-3) === 0 && inviteBonusBp(Number.NaN) === 0);

    const DAY = 86_400_000;
    const joined = new Date("2026-03-02T10:00:00.000Z"); // a Monday, 10:00
    const expiresAt = inviteExpiresAt(joined);
    check("invite: expires exactly 7 days after its own join (next Monday 10:00)", expiresAt.toISOString() === "2026-03-09T10:00:00.000Z");
    check("invite: counts just before expiry", isInviteCreditActive({ expiresAt }, new Date(expiresAt.getTime() - 1)));
    check("invite: does not count at the exact expiry instant", !isInviteCreditActive({ expiresAt }, expiresAt));
    check("invite: does not count after expiry", !isInviteCreditActive({ expiresAt }, new Date(expiresAt.getTime() + 1)));
    check("invite: does not count while the invitee is out of the guild", !isInviteCreditActive({ expiresAt, leftAt: joined }, joined));

    // Independent expiry — no weekly reset: A has 7 days left, B has 2; three days later only A counts.
    const now = new Date("2026-03-10T00:00:00.000Z");
    const a = { expiresAt: inviteExpiresAt(now) };
    const b = { expiresAt: inviteExpiresAt(new Date(now.getTime() - 5 * DAY)) };
    const later = new Date(now.getTime() + 3 * DAY);
    check("invite: independent expiry — A still counts after 3 days", isInviteCreditActive(a, later));
    check("invite: independent expiry — B does not", !isInviteCreditActive(b, later));
    check("invite: independent expiry — active count is 1", countActiveInviteCredits([a, b], later) === 1);

    // Slots: a full inviter is not credited; an expiry frees a slot for the next invite.
    const credits = Array.from({ length: 10 }, (_, i) => ({ expiresAt: new Date(now.getTime() + (i + 1) * DAY / 2) }));
    const full = countActiveInviteCredits(credits, now);
    check("invite: 10 active credits fill every slot", full === 10 && inviteBonusBp(full) === 1_000);
    check("invite: an 11th join while full is not credited", decideInviteCredit({ inviterId: "A", inviteeId: "X", alreadyCredited: false, inviterActiveCredits: full }) === "slots-full");
    const afterOneExpires = countActiveInviteCredits(credits, new Date(now.getTime() + DAY / 2));
    check("invite: one expiry frees a slot (10 → 9, +9%)", afterOneExpires === 9 && inviteBonusBp(afterOneExpires) === 900);
    check("invite: a freed slot accepts a new credit", decideInviteCredit({ inviterId: "A", inviteeId: "X", alreadyCredited: false, inviterActiveCredits: afterOneExpires }) === "credit");

    check("invite: self-invites are never credited", decideInviteCredit({ inviterId: "A", inviteeId: "A", alreadyCredited: false, inviterActiveCredits: 0 }) === "self-invite");
    check("invite: no attributable inviter is never credited", decideInviteCredit({ inviterId: null, inviteeId: "X", alreadyCredited: false, inviterActiveCredits: 0 }) === "no-inviter");
    check("invite: an already-credited member is never credited again", decideInviteCredit({ inviterId: "A", inviteeId: "X", alreadyCredited: true, inviterActiveCredits: 0 }) === "already-credited");
}

// Which invite was used — diffing the guild's invite list before and after a join.
{
    const snap = (code: string, uses: number, inviterId: string | null = "A", maxUses = 0): InviteUseSnapshot => ({ code, uses, maxUses, inviterId });
    const map = (...invites: InviteUseSnapshot[]) => new Map(invites.map(i => [i.code, i]));

    check("invite detection: the one invite whose uses rose is the one used",
        detectUsedInvite(map(snap("a", 3), snap("b", 1, "B")), map(snap("a", 3), snap("b", 2, "B")))?.inviterId === "B");
    check("invite detection: an invite created since the last snapshot counts from 0",
        detectUsedInvite(map(snap("a", 3)), map(snap("a", 3), snap("new", 1, "C")))?.code === "new");
    check("invite detection: two rising invites is ambiguous → no credit",
        detectUsedInvite(map(snap("a", 1), snap("b", 1)), map(snap("a", 2), snap("b", 2))) === null);
    check("invite detection: an invite used up (and deleted by Discord) is detected",
        detectUsedInvite(map(snap("a", 4, "A", 5), snap("b", 0)), map(snap("b", 0)))?.code === "a");
    check("invite detection: nothing changed (vanity URL, duplicate event) → no credit",
        detectUsedInvite(map(snap("a", 1)), map(snap("a", 1))) === null);
}

// Leave / rejoin / duplicate events — the real `recordInviteeJoin`/`recordInviteeLeave`, against an
// in-memory store that mirrors the repository: unique per `{guildId, inviteeId}`, rows never deleted.
{
    const rows: Array<{ guildId: string; inviterId: string; inviteeId: string; expiresAt: Date; leftAt: Date | null }> = [];
    const store: InviteCreditStore = {
        async credit(guildId, inviterId, inviteeId, _code, _joinedAt, expiresAt) {
            if (rows.some(r => r.guildId === guildId && r.inviteeId === inviteeId)) return false;
            rows.push({ guildId, inviterId, inviteeId, expiresAt, leftAt: null });
            return true;
        },
        async countActive(guildId, inviterId, now) {
            return countActiveInviteCredits(rows.filter(r => r.guildId === guildId && r.inviterId === inviterId), now);
        },
        async markLeft(guildId, inviteeId, at) {
            const row = rows.find(r => r.guildId === guildId && r.inviteeId === inviteeId && r.leftAt === null);
            if (row) row.leftAt = at;
        },
        async markRejoined(guildId, inviteeId) {
            const row = rows.find(r => r.guildId === guildId && r.inviteeId === inviteeId);
            if (row) row.leftAt = null;
            return Boolean(row);
        },
    };

    const HOUR = 3_600_000;
    const t0 = new Date("2026-04-01T00:00:00.000Z");
    const at = (h: number) => new Date(t0.getTime() + h * HOUR);
    const viaA = { code: "abc", inviterId: "A" };

    check("invite flow: invited member joins → credit created", await recordInviteeJoin("g", "B", viaA, t0, store) === "credit");
    check("invite flow: the inviter now has +1%", inviteBonusBp(await store.countActive("g", "A", at(1))) === 100);

    check("invite flow: duplicate join event → no second credit", await recordInviteeJoin("g", "B", viaA, t0, store) === "already-credited");
    check("invite flow: still exactly one credit row", rows.length === 1);

    await recordInviteeLeave("g", "B", at(2), store);
    check("invite flow: invitee leaves → the credit stops counting", await store.countActive("g", "A", at(3)) === 0);
    check("invite flow: the credit row is kept after leaving", rows.length === 1);

    check("invite flow: rejoining through the same invite → no new credit", await recordInviteeJoin("g", "B", viaA, at(4), store) === "already-credited");
    check("invite flow: rejoining through someone else's invite → no new credit", await recordInviteeJoin("g", "B", { code: "xyz", inviterId: "C" }, at(5), store) === "already-credited");
    check("invite flow: no credit was minted for the second inviter", await store.countActive("g", "C", at(6)) === 0);
    check("invite flow: the original credit resumes, under its original expiry", await store.countActive("g", "A", at(6)) === 1 && rows[0]!.expiresAt.getTime() === inviteExpiresAt(t0).getTime());
    check("invite flow: rejoining does not extend the 7-day window", await store.countActive("g", "A", inviteExpiresAt(t0)) === 0);

    check("invite flow: self-invite is not credited", await recordInviteeJoin("g", "A", viaA, t0, store) === "self-invite");
    check("invite flow: the same member in another guild is a separate relationship", await recordInviteeJoin("g2", "B", viaA, t0, store) === "credit");

    for (let i = 0; i < 12; i++) await recordInviteeJoin("g3", `m${i}`, { code: "bulk", inviterId: "Z" }, at(i), store);
    check("invite flow: an inviter never holds more than 10 active credits", await store.countActive("g3", "Z", at(12)) === 10);
    check("invite flow: full-slot joins are not burned (no row written)", !rows.some(r => r.guildId === "g3" && (r.inviteeId === "m10" || r.inviteeId === "m11")));
}

// ============================================================================
// INTEGRATION — Booster + Invite alongside every other bonus.
// ============================================================================

{
    // The spec's worked example: base 50M, staff ×1.4, level +20%, streak +5%, server tag +10%,
    // booster +7.5% (1 boost, 30 days), invites +4%.
    const breakdown = {
        staffMultiplierBp: 14_000,
        levelBp: levelBonusBp(4, [4, 10]),
        streakBp: streakBonusBp(50),
        boosterBp: boosterBonusBp(1, 30),
        serverTagBp: serverTagBonusBp(true),
        inviteBp: inviteBonusBp(4),
        referralBp: 0,
        premiumBp: 0,
    };
    const worked = calculateReward(50, breakdown);
    check("integration: level + streak + server tag + booster + invites total +46.5%", worked.totalBonusBp === 4_650, `${worked.totalBonusBp}`);
    check(
        "integration: 50M × 1.4 × 1.465 is exactly 102.55M before rounding",
        50 * breakdown.staffMultiplierBp * (BP_SCALE + worked.totalBonusBp) * 100 === 10_255 * BP_SCALE * BP_SCALE,
    );
    check("integration: the worked example credits 103 whole units (102.55M rounded once, at the end)", worked.final === 103, `final=${worked.final}`);

    const both = calculateBonusBreakdown({ boosterCount: 6, boosterContinuousDays: 5, activeInviteSlots: 10 });
    check("integration: booster + invite are additive", calculateReward(100, both).totalBonusBp === 2_500);
    check("integration: max booster is +15%, max invite is +10%", both.boosterBp === 1_500 && both.inviteBp === 1_000);

    const withLevel = reward(100, { level: 50, configuredLevelPoints: [50], boosterCount: 1, boosterContinuousDays: 30, activeInviteSlots: 3 });
    check("integration: booster + invite + level", withLevel.totalBonusBp === 5_000 + 750 + 300, `${withLevel.totalBonusBp}`);

    const withStreak = reward(100, { streakDays: 100, boosterCount: 3, boosterContinuousDays: 15, activeInviteSlots: 2 });
    check("integration: booster + invite + streak", withStreak.totalBonusBp === 1_000 + 750 + 200, `${withStreak.totalBonusBp}`);

    const staffed = reward(100, { staffScore: 100, boosterCount: 6, boosterContinuousDays: 5, activeInviteSlots: 10 });
    check("integration: staff multiplies once, bonuses add once — 100 × 1.6 × 1.25 = 200", staffed.final === 200, `final=${staffed.final}`);

    const everything: RewardBonusInputs = {
        level: 99, configuredLevelPoints: LEVEL_POINTS, staffScore: 100, streakDays: 100,
        boosterCount: 50, boosterContinuousDays: 9_999, hasServerTag: true, activeInviteSlots: 99,
    };
    const first = reward(100, everything);
    const second = reward(100, everything);
    check("integration: no duplicate bonuses — the total is exactly the sum of each capped source", first.totalBonusBp === 5_000 + 1_000 + 1_500 + 1_000 + 1_000);
    check("integration: repeated resolution never accumulates", JSON.stringify(first) === JSON.stringify(second));
}

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}

console.log("\nAll reward checks passed.");
