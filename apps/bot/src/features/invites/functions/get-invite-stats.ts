import { InviteJoinRepository } from "@database/repositories";
import { getActiveInviteCount, inviteBonusBp } from "@core/rewards";
import { INVITES_CONFIG } from "@constants";
import { inviteTotal } from "../utils/invite-format";

export interface InviteStats {
    joins: number;
    leaves: number;
    /** Joins minus leaves — "N invites in total". */
    total: number;
    /** Joins inside the rolling `recentWindowDays` window — "N invites this week". */
    recentJoins: number;
    /** The live Invite reward bonus, from the same active credits `claimReward` counts. */
    bonusBp: number;
}

export async function getInviteStats(guildId: string, inviterId: string, now: Date = new Date()): Promise<InviteStats> {
    const since = new Date(now.getTime() - INVITES_CONFIG.recentWindowDays * 86_400_000);

    const [counts, activeCredits] = await Promise.all([
        InviteJoinRepository.countsFor(guildId, inviterId, since),
        getActiveInviteCount(guildId, inviterId, now),
    ]);

    return { ...counts, total: inviteTotal(counts), bonusBp: inviteBonusBp(activeCredits) };
}
