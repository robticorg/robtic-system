import { RewardServerTagPresenceRepository } from "@database/repositories";
import { utcDateKey } from "@utils";
import { REWARD_SERVER_TAG_BONUS } from "@constants";
import { isServerTagActive, type PrimaryGuildIdentity } from "./server-tag";

export interface ServerTagPresenceDecision {
    /** Whether the +10% bonus should apply right now. */
    eligible: boolean;
    /**
     * What today's stored `activeSince` should become. `null` means "clear the row" (the tag is
     * inactive); otherwise the timestamp to persist — either the existing one, unchanged, or `now`
     * when this is the first time today the tag was seen active.
     */
    nextActiveSince: Date | null;
}

/**
 * Decides Server Tag eligibility for one check, given what is currently true and what was stored.
 *
 * Pure — no database, no gateway, no clock of its own (`now` is supplied). This is what makes the
 * 6-hour rule testable without a database: feed it a `storedActiveSince` and a `now` and it always
 * gives the same answer.
 *
 * The rule: the tag must be active right now, **and** it must have been continuously active for at
 * least `REWARD_SERVER_TAG_BONUS.minContinuousHours` — timed from the first moment it was *observed*
 * active today, never from a moment before this system started watching. A member who enables the
 * tag and claims immediately gets `nextActiveSince = now`, `eligible = false`: the window has to
 * elapse for real, and enabling it again later cannot back-date the start of that window.
 */
export function decideServerTagPresence(
    isActiveNow: boolean,
    storedActiveSince: Date | null,
    now: Date,
): ServerTagPresenceDecision {
    if (!isActiveNow) return { eligible: false, nextActiveSince: null };

    const since = storedActiveSince ?? now;
    const hoursActive = (now.getTime() - since.getTime()) / 3_600_000;

    return {
        eligible: hoursActive >= REWARD_SERVER_TAG_BONUS.minContinuousHours,
        nextActiveSince: since,
    };
}

/**
 * Resolves Server Tag eligibility for a real member: reads today's stored presence, decides, and
 * persists whatever changed — the one place discord.js-free logic (`decideServerTagPresence`) meets
 * the database. Scoped to the UTC calendar day, so "each day resets the timer": a new day has no
 * row yet, and the first observation of that day always starts the window over, however long the
 * tag was worn on previous days.
 *
 * Safe to call as often as the bot happens to check (a claim, a future `/profile` read, anything
 * else) — it only ever writes when the tag is freshly observed active or has gone inactive, and
 * `markActiveSince`'s `$setOnInsert` guarantees a later call can never push the start of the window
 * forward.
 */
export async function resolveServerTagEligibility(
    guildId: string,
    discordId: string,
    primaryGuild: PrimaryGuildIdentity | null | undefined,
    now: Date = new Date(),
): Promise<boolean> {
    const dayKey = utcDateKey(now);
    const isActiveNow = isServerTagActive(primaryGuild, guildId);
    const storedActiveSince = await RewardServerTagPresenceRepository.getActiveSince(guildId, discordId, dayKey);

    const decision = decideServerTagPresence(isActiveNow, storedActiveSince, now);

    if (decision.nextActiveSince === null) {
        if (storedActiveSince !== null) await RewardServerTagPresenceRepository.clear(guildId, discordId, dayKey);
    } else if (storedActiveSince === null) {
        await RewardServerTagPresenceRepository.markActiveSince(guildId, discordId, dayKey, decision.nextActiveSince);
    }

    return decision.eligible;
}
