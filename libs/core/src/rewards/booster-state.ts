import { RewardBoosterStateRepository } from "@database/repositories";
import { REWARD_BOOSTER_BONUS } from "@constants";

/**
 * Booster bonus state: *how many* boosts a member currently has in a guild, and *since when* they
 * have been boosting without a gap. The bonus itself is never stored — `boosterBonusBp` derives it
 * from these two facts at claim time.
 *
 * Discord gives bots three signals, and each one is used for exactly what it can prove:
 *
 * - `GuildMember.premiumSince` — on/off, and Discord's own "boosting continuously since". This is
 *   authoritative for the start of the period, so a bot restart or a missed event never loses
 *   progress, and `null` always means zero boosts.
 * - Boost announcements (`MessageType.GuildBoost*`, one per boost action, authored by the booster)
 *   — the only per-member signal that the count went *up*.
 * - The guild's `premiumSubscriptionCount` — the only signal that a count went *down* while the
 *   member kept at least one boost. It is guild-wide, so a drop is attributed conservatively (see
 *   `reconcileBoostCounts`): ambiguity may under-count, never over-count.
 *
 * Everything below the I/O line is a pure transition over `BoosterStateSnapshot`, so every rule is
 * testable without a database or a gateway.
 */

const DAY_MS = 86_400_000;
const SAME_PERIOD_TOLERANCE_MS = REWARD_BOOSTER_BONUS.samePeriodToleranceMinutes * 60_000;

/** One member's stored boost state. `null` everywhere below means "not boosting". */
export interface BoosterStateSnapshot {
    /** Boosts observed this period; 0 = boosting, count not yet observed (counts as 1). */
    boostCount: number;
    continuousStartedAt: Date;
}

/** Days elapsed between `startedAt` and `now`, never negative. */
export function continuousDaysSince(startedAt: Date, now: Date): number {
    const elapsed = now.getTime() - startedAt.getTime();
    return Number.isFinite(elapsed) ? Math.max(0, elapsed / DAY_MS) : 0;
}

/**
 * The boost count the bonus is calculated from. A stored row proves at least one active boost, so
 * an unobserved count (0) resolves to 1; no row resolves to 0.
 */
export function effectiveBoostCount(state: BoosterStateSnapshot | null): number {
    if (!state) return 0;
    const observed = Number.isFinite(state.boostCount) ? Math.floor(state.boostCount) : 0;
    return Math.max(1, observed);
}

function isValidDate(date: Date | null | undefined): date is Date {
    return date instanceof Date && Number.isFinite(date.getTime());
}

function notAfter(date: Date, now: Date): Date {
    return date.getTime() > now.getTime() ? now : date;
}

function sameState(a: BoosterStateSnapshot | null, b: BoosterStateSnapshot | null): boolean {
    if (a === null || b === null) return a === b;
    return a.boostCount === b.boostCount && a.continuousStartedAt.getTime() === b.continuousStartedAt.getTime();
}

/**
 * Applies Discord's live `premiumSince` to the stored state.
 *
 * - `null` → not boosting: the state is cleared, bonus +0%.
 * - No stored state → a new period starting at `premiumSince` (count not yet observed).
 * - `premiumSince` later than the stored start (beyond the tolerance) → the member stopped and
 *   started again unobserved; the old count belonged to the old period and is dropped.
 * - Otherwise the same period continues: the count is kept and the start aligned to Discord's.
 *
 * A `premiumSince` in the future is clamped to `now`, so duration can never be negative.
 */
export function applyPremiumSince(
    stored: BoosterStateSnapshot | null,
    premiumSince: Date | null,
    now: Date,
): BoosterStateSnapshot | null {
    if (premiumSince === null) return null;

    const since = notAfter(isValidDate(premiumSince) ? premiumSince : (stored?.continuousStartedAt ?? now), now);
    if (!stored) return { boostCount: 0, continuousStartedAt: since };

    const restarted = since.getTime() - stored.continuousStartedAt.getTime() > SAME_PERIOD_TOLERANCE_MS;
    return { boostCount: restarted ? 0 : stored.boostCount, continuousStartedAt: since };
}

/**
 * Applies a boost announcement: the author just added `boosts` boosts (1 unless the announcement
 * says otherwise). The announcement itself proves the member is boosting, so a stale-cache `null`
 * `premiumSince` falls back to the stored start, or to the announcement's own time.
 *
 * A first boost produces both an announcement and a `premiumSince` change, in either order; that
 * is why an unobserved count is stored as 0, not 1 — `0 + 1` and `max(1, 1)` agree either way.
 */
export function applyBoostAnnouncement(
    stored: BoosterStateSnapshot | null,
    boosts: number,
    premiumSince: Date | null,
    at: Date,
): BoosterStateSnapshot {
    const added = Number.isFinite(boosts) && boosts >= 1 ? Math.floor(boosts) : 1;
    const period = applyPremiumSince(stored, premiumSince ?? stored?.continuousStartedAt ?? at, at)!;
    return { boostCount: period.boostCount + added, continuousStartedAt: period.continuousStartedAt };
}

/**
 * Lowers tracked counts so they never add up to more than the guild actually has.
 *
 * Discord only reports the guild's total, so when tracked counts exceed it the missing boosts
 * cannot be attributed to a specific member. Each multi-boost member is lowered to the smallest
 * count consistent with the total (`max(1, count - excess)`): with one candidate that is exact, and
 * with several it can under-count, but it can never leave anyone with more boosts — and so a
 * higher bonus — than they could really still have. Returns only the rows that change.
 */
export function reconcileBoostCounts(
    tracked: ReadonlyArray<{ discordId: string; boostCount: number }>,
    guildTotal: number,
): Map<string, number> {
    const changes = new Map<string, number>();
    if (!Number.isFinite(guildTotal) || guildTotal < 0) return changes;

    const effective = tracked.map(row => ({ discordId: row.discordId, count: Math.max(1, Math.floor(row.boostCount) || 0) }));
    const excess = effective.reduce((sum, row) => sum + row.count, 0) - guildTotal;
    if (excess <= 0) return changes;

    for (const row of effective) {
        if (row.count <= 1) continue;
        changes.set(row.discordId, Math.max(1, row.count - excess));
    }
    return changes;
}

export interface GuildBoosterSyncPlan {
    save: Map<string, BoosterStateSnapshot>;
    clear: string[];
}

/**
 * Plans a full guild resync from a fresh member list: clears everyone tracked who no longer
 * boosts (or left), applies every current booster's `premiumSince`, then reconciles the counts
 * against the guild's total. Only differences from what is stored end up in the plan.
 */
export function planGuildBoosterSync(
    tracked: ReadonlyMap<string, BoosterStateSnapshot>,
    boosters: ReadonlyArray<{ discordId: string; premiumSince: Date }>,
    guildTotal: number | null,
    now: Date,
): GuildBoosterSyncPlan {
    const boosting = new Set(boosters.map(b => b.discordId));
    const clear = [...tracked.keys()].filter(id => !boosting.has(id));

    const next = new Map<string, BoosterStateSnapshot>();
    for (const booster of boosters) {
        const state = applyPremiumSince(tracked.get(booster.discordId) ?? null, booster.premiumSince, now);
        if (state) next.set(booster.discordId, state);
    }

    if (guildTotal !== null) {
        const rows = [...next].map(([discordId, state]) => ({ discordId, boostCount: state.boostCount }));
        for (const [discordId, boostCount] of reconcileBoostCounts(rows, guildTotal)) {
            next.set(discordId, { ...next.get(discordId)!, boostCount });
        }
    }

    const save = new Map([...next].filter(([id, state]) => !sameState(tracked.get(id) ?? null, state)));
    return { save, clear };
}

// ---------------------------------------------------------------------------------------------
// I/O — read, apply one of the pure transitions above, persist only what changed.
// ---------------------------------------------------------------------------------------------

async function loadState(guildId: string, discordId: string): Promise<BoosterStateSnapshot | null> {
    const row = await RewardBoosterStateRepository.get(guildId, discordId);
    return row ? { boostCount: row.boostCount, continuousStartedAt: row.continuousStartedAt } : null;
}

async function persist(
    guildId: string,
    discordId: string,
    before: BoosterStateSnapshot | null,
    after: BoosterStateSnapshot | null,
): Promise<void> {
    if (sameState(before, after)) return;
    if (after === null) await RewardBoosterStateRepository.clear(guildId, discordId);
    else await RewardBoosterStateRepository.save(guildId, discordId, after.boostCount, after.continuousStartedAt);
}

/** Records a member's live `premiumSince` (a `guildMemberUpdate`, or a claim-time snapshot). Never awards anything. */
export async function observeBoosterPremiumSince(
    guildId: string,
    discordId: string,
    premiumSince: Date | null,
    now: Date = new Date(),
): Promise<BoosterStateSnapshot | null> {
    const before = await loadState(guildId, discordId);
    const after = applyPremiumSince(before, premiumSince, now);
    await persist(guildId, discordId, before, after);
    return after;
}

/** Records a boost announcement by `discordId`. Never awards anything. */
export async function recordBoostAnnouncement(
    guildId: string,
    discordId: string,
    boosts: number,
    premiumSince: Date | null,
    at: Date = new Date(),
): Promise<void> {
    const before = await loadState(guildId, discordId);
    await persist(guildId, discordId, before, applyBoostAnnouncement(before, boosts, premiumSince, at));
}

/** A member left: their boosts left with them. */
export async function clearBoosterState(guildId: string, discordId: string): Promise<void> {
    await RewardBoosterStateRepository.clear(guildId, discordId);
}

/** Resyncs a whole guild from a fresh member list — run when the guild's boost total drops. */
export async function syncGuildBoosters(
    guildId: string,
    boosters: ReadonlyArray<{ discordId: string; premiumSince: Date }>,
    guildTotal: number | null,
    now: Date = new Date(),
): Promise<void> {
    const rows = await RewardBoosterStateRepository.listByGuild(guildId);
    const tracked = new Map(rows.map(row => [row.discordId, { boostCount: row.boostCount, continuousStartedAt: row.continuousStartedAt }]));

    const plan = planGuildBoosterSync(tracked, boosters, guildTotal, now);
    await Promise.all([
        ...plan.clear.map(id => RewardBoosterStateRepository.clear(guildId, id)),
        ...[...plan.save].map(([id, s]) => RewardBoosterStateRepository.save(guildId, id, s.boostCount, s.continuousStartedAt)),
    ]);
}

export interface BoosterProgress {
    boostCount: number;
    continuousDays: number;
}

/**
 * What `resolveRewardBonuses` needs for the Booster bonus: the current effective count and how
 * long the current period has run.
 *
 * `premiumSince` is the caller's live snapshot (`member.premiumSince`). When supplied, it is
 * applied first, so a claim is correct even if every gateway event since the last restart was
 * missed: `null` clears the state (+0%), a date creates or corrects it. When omitted (`undefined`),
 * the stored state is used as-is.
 */
export async function getBoosterProgress(
    guildId: string,
    discordId: string,
    now: Date = new Date(),
    premiumSince?: Date | null,
): Promise<BoosterProgress> {
    const state = premiumSince === undefined
        ? await loadState(guildId, discordId)
        : await observeBoosterPremiumSince(guildId, discordId, premiumSince, now);

    if (!state) return { boostCount: 0, continuousDays: 0 };
    return { boostCount: effectiveBoostCount(state), continuousDays: continuousDaysSince(state.continuousStartedAt, now) };
}
