import { StaffTierRepository, StreakRepository, ActivityRepository, LevelRewardRepository } from "@database/repositories";
import { calculateBonusBreakdown } from "./reward-calculator";
import { resolveServerTagEligibility } from "./server-tag-presence";
import { getBoosterProgress } from "./booster-state";
import { getActiveInviteCount } from "./invite-credit";
import { getReferralCodeBonusBp } from "./referral-code";
import type { PrimaryGuildIdentity } from "./server-tag";
import type { RewardBonusBreakdown, RewardBonusInputs } from "./reward-bonus-types";

/**
 * Bonus inputs `resolveRewardBonuses` cannot fetch itself, because they are not database records
 * describing the member directly.
 *
 * `primaryGuild` is the member's raw, live Discord Server Tag state (`member.user.primaryGuild`) —
 * the discord.js-aware caller reads it and passes it through unmodified, the same way `roleIds` is
 * supplied rather than fetched. It is **not** trusted as-is: `resolveRewardBonuses` runs it through
 * `resolveServerTagEligibility`, which enforces the 6-continuous-hour rule before it can become a
 * bonus, so no caller can grant the +10% just by asserting a boolean.
 *
 * `premiumSince` is the member's live `member.premiumSince`, passed through the same way. It is not a
 * bonus either: `getBoosterProgress` applies it to the stored `RewardBoosterState` first, so a member
 * who stopped boosting while the bot missed the event gets +0%, and one whose state was never
 * recorded gets their real continuous duration from Discord. Omitting it uses the stored state as
 * the gateway events left it. Invite (`RewardInviteCredit`) needs nothing from the caller — see
 * `booster-state.ts` and `invite-credit.ts`. Referral is deliberately *not* accepted here: it is
 * always read from the member's stored code link, so no caller can pass in a referral bonus.
 */
export interface UnwiredRewardBonusInputs {
    /** The member's live `member.user.primaryGuild` snapshot, or omit/null if unavailable. */
    primaryGuild?: PrimaryGuildIdentity | null;
    /** The member's live `member.premiumSince` (`null` = not boosting), or omit if unavailable. */
    premiumSince?: Date | null;
}

/** The member's score from whichever of their held roles matches the highest-scoring StaffTier. */
function bestStaffScore(tiers: { score: number; roleIds: string[] }[], roleIds: readonly string[]): number {
    let best = 0;
    for (const tier of tiers) {
        if (tier.score > best && tier.roleIds.some(roleId => roleIds.includes(roleId))) best = tier.score;
    }
    return best;
}

/**
 * Resolves a member's current reward bonuses by reusing the systems that already own each number:
 * `StaffTier` for staff, `ActivityXP` for level, `Streak` for streak days, the existing
 * `LevelReward` roles (`/level-rewards`) for the level bonus's configured points,
 * `resolveServerTagEligibility` for Server Tag (live Discord state plus
 * the 6-hour continuous-wear requirement), `getBoosterProgress` for Booster (current boost count
 * plus how long it has run, continuously), `getActiveInviteCount` for Invite (unexpired credits
 * only), and `getReferralCodeBonusBp` for Referral (the member's applied code, only while it exists
 * and is active). Nothing here is discord.js-aware — `roleIds` and `unwired.primaryGuild` are all it needs
 * from a member.
 *
 * Never throws on a missing record: a member with no streak, no XP row, no staff tier, no booster
 * state, or no invite credits simply gets no bonus from that source, and a guild with no level
 * rewards configured gets no level bonus at all rather than a fallback curve. Every source here is
 * evaluated fresh on every call — nothing is cached or stored beyond each source's own minimal
 * state (Server Tag's one daily timestamp, Booster's one continuous-start timestamp, Invite's
 * per-credit expiry), so a streak resetting, a Server Tag being removed, a boost count dropping, or
 * an invite expiring is reflected on the very next claim, with no migration and no member update
 * required.
 *
 * `now` is accepted (defaulting to the real clock) purely so Server Tag's window, Booster's
 * elapsed duration, and Invite's expiry can all be tested deterministically.
 */
export async function resolveRewardBonuses(
    guildId: string,
    discordId: string,
    roleIds: readonly string[],
    unwired: UnwiredRewardBonusInputs = {},
    now: Date = new Date(),
): Promise<RewardBonusBreakdown> {
    const [tiers, streak, activity, levelRewards, hasServerTag, booster, activeInviteSlots, referralCodeBp] = await Promise.all([
        StaffTierRepository.getCached(guildId),
        StreakRepository.find(discordId, guildId),
        ActivityRepository.find(discordId, guildId),
        LevelRewardRepository.getAll(guildId),
        resolveServerTagEligibility(guildId, discordId, unwired.primaryGuild ?? null, now),
        getBoosterProgress(guildId, discordId, now, unwired.premiumSince),
        getActiveInviteCount(guildId, discordId, now),
        getReferralCodeBonusBp(guildId, discordId),
    ]);

    const inputs: RewardBonusInputs = {
        level: activity?.level ?? 0,
        configuredLevelPoints: levelRewards.map(reward => reward.level),
        staffScore: bestStaffScore(tiers, roleIds),
        streakDays: streak?.currentStreak ?? 0,
        boosterCount: booster.boostCount,
        boosterContinuousDays: booster.continuousDays,
        hasServerTag,
        activeInviteSlots,
        referralCodeBp,
    };

    return calculateBonusBreakdown(inputs);
}
