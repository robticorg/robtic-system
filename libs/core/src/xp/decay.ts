import { BP_SCALE, DECAY_CONFIG } from "@constants";

const DAY_MS = 86_400_000;

/**
 * XP decay, one kind at a time (message or voice), from that kind's own inactivity clock. Pure —
 * the scheduler reads the timestamps and applies whatever this returns.
 */

/** The percentage (basis points) lost on the `dayIndex`-th decay day: 0 = the first. */
export function decayRateBp(dayIndex: number): number {
    if (!Number.isFinite(dayIndex) || dayIndex < 0) return 0;
    return Math.min(DECAY_CONFIG.startBp + Math.floor(dayIndex) * DECAY_CONFIG.perDayBp, DECAY_CONFIG.maxBp);
}

/**
 * How much XP of one kind decays right now, and at what rate.
 *
 * - Nothing until the kind has been inactive for `inactiveDaysThreshold` whole days.
 * - At most once per day: nothing if it already decayed within the last 24 hours.
 * - Otherwise a percentage of the XP the member has now (see `decayRateBp`), rounded up so even a
 *   small balance keeps shrinking, and never more than they have.
 *
 * Driven by timestamps, never by counting runs, so an hourly scheduler (or a restart) can't make it
 * faster than once a day. Days the bot was offline are not made up afterwards.
 */
export function decayLossForKind(
    xp: number,
    activeAt: Date,
    decayedAt: Date | null,
    now: Date = new Date(),
): { loss: number; rateBp: number } {
    if (!Number.isFinite(xp) || xp <= 0) return { loss: 0, rateBp: 0 };

    const inactiveDays = Math.floor((now.getTime() - activeAt.getTime()) / DAY_MS);
    if (!(inactiveDays >= DECAY_CONFIG.inactiveDaysThreshold)) return { loss: 0, rateBp: 0 };
    if (decayedAt && now.getTime() - decayedAt.getTime() < DAY_MS) return { loss: 0, rateBp: 0 };

    const rateBp = decayRateBp(inactiveDays - DECAY_CONFIG.inactiveDaysThreshold);
    const loss = Math.min(Math.floor(xp), Math.ceil((xp * rateBp) / BP_SCALE));
    return { loss, rateBp };
}
