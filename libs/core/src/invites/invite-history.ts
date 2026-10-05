import { INVITES_CONFIG } from "@constants";
import { InviteJoinRepository } from "@database/repositories";
import type { InviteJoinSource } from "@database/models/InviteJoin";
import { getActiveInviteCount, inviteBonusBp, recordInviteeJoin, recordInviteeLeave, type InviteCreditDecision, type InviteCreditStore } from "../rewards";

/**
 * The invite domain: join/leave processing (run by the worker) and the reads behind `/invites`
 * and `/info` (served by the Invites API). Discord-free — the Gateway detects which invite was
 * used (it holds the invite cache) and posts announcements; everything else happens here.
 *
 * Every write is safe to repeat, because queue jobs can be retried after a crash:
 * - a join is recorded once (unique `{guildId, inviteeId, joinedAt}`), the reward credit once per
 *   member ever;
 * - a leave closes the member's open join, and a repeat finds the join it already closed.
 */

const DAY_MS = 86_400_000;

/** The earliest real join that makes a join at `joinedAt` fake (a rejoin inside `fakeWindowDays`). */
export function fakeWindowStart(joinedAt: Date): Date {
    return new Date(joinedAt.getTime() - INVITES_CONFIG.fakeWindowDays * DAY_MS);
}

/** Invites a member still has credit for: everyone they brought in, minus those who left. */
export function inviteTotal(counts: { joins: number; leaves: number }): number {
    return Math.max(0, counts.joins - counts.leaves);
}

export interface InviteHistoryStore {
    hasRealJoinSince(guildId: string, inviteeId: string, since: Date): Promise<boolean>;
    record(entry: {
        guildId: string;
        inviteeId: string;
        inviterId: string | null;
        inviteCode: string | null;
        source: InviteJoinSource;
        joinedAt: Date;
        fake: boolean;
    }): Promise<boolean>;
    /** Closes the member's open join at `at` — or, on a repeat, returns the join already closed at `at`. */
    closeLatest(guildId: string, inviteeId: string, at: Date): Promise<{ inviterId: string | null; source: InviteJoinSource } | null>;
}

export const repositoryInviteHistoryStore: InviteHistoryStore = {
    hasRealJoinSince: (g, i, since) => InviteJoinRepository.hasRealJoinSince(g, i, since),
    record: entry => InviteJoinRepository.record(entry),
    closeLatest: (g, i, at) => InviteJoinRepository.closeLatest(g, i, at),
};

export interface DetectedInviteUse {
    code: string;
    inviterId: string | null;
    vanity?: boolean;
}

export interface InviteJoinOutcome {
    /** `false` for a repeat of a join already recorded — nothing new happened, nothing to announce. */
    recorded: boolean;
    fake: boolean;
    credit: InviteCreditDecision;
}

/** A member joined: fake check, reward credit, join history. */
export async function processInviteJoin(
    input: { guildId: string; memberId: string; joinedAt: Date; used: DetectedInviteUse | null },
    stores: { history?: InviteHistoryStore; credits?: InviteCreditStore } = {},
): Promise<InviteJoinOutcome> {
    const history = stores.history ?? repositoryInviteHistoryStore;
    const { guildId, memberId, joinedAt, used } = input;

    const fake = await history.hasRealJoinSince(guildId, memberId, fakeWindowStart(joinedAt));
    const credit = await recordInviteeJoin(guildId, memberId, used?.vanity ? null : used, joinedAt, stores.credits);
    const recorded = await history.record({
        guildId,
        inviteeId: memberId,
        inviterId: used?.inviterId ?? null,
        inviteCode: used?.code ?? null,
        source: used?.vanity ? "vanity" : used?.inviterId ? "invite" : "unknown",
        joinedAt,
        fake,
    });

    return { recorded, fake, credit };
}

/** A member left: their credit stops counting and their join is closed. Returns how they had joined. */
export async function processInviteLeave(
    input: { guildId: string; memberId: string; leftAt: Date },
    stores: { history?: InviteHistoryStore; credits?: InviteCreditStore } = {},
): Promise<{ inviterId: string | null; source: InviteJoinSource } | null> {
    const history = stores.history ?? repositoryInviteHistoryStore;
    await recordInviteeLeave(input.guildId, input.memberId, input.leftAt, stores.credits);
    return history.closeLatest(input.guildId, input.memberId, input.leftAt);
}

export interface InviteStats {
    /** Real joins — fakes excluded. */
    joins: number;
    leaves: number;
    /** Rejoins inside the fake window. */
    fakes: number;
    /** Joins minus leaves — "N invites in total". */
    total: number;
    /** Real joins inside the rolling `recentWindowDays` window still in the server — "N invites this week". */
    recentJoins: number;
    /** The live Invite reward bonus, from the same active credits `claimReward` counts. */
    bonusBp: number;
}

export async function getInviteStats(guildId: string, inviterId: string, now: Date = new Date()): Promise<InviteStats> {
    const since = new Date(now.getTime() - INVITES_CONFIG.recentWindowDays * DAY_MS);
    const [counts, activeCredits] = await Promise.all([
        InviteJoinRepository.countsFor(guildId, inviterId, since),
        getActiveInviteCount(guildId, inviterId, now),
    ]);
    return { ...counts, total: inviteTotal(counts), bonusBp: inviteBonusBp(activeCredits) };
}

export interface InvitedMember {
    inviteeId: string;
    joinedAt: string;
    leftAt: string | null;
    fake: boolean;
}

/** One page of everyone `inviterId` invited, newest first, with the total for paging. */
export async function listInvited(guildId: string, inviterId: string, skip: number, limit: number): Promise<{ total: number; rows: InvitedMember[] }> {
    const [total, rows] = await Promise.all([
        InviteJoinRepository.countByInviter(guildId, inviterId),
        InviteJoinRepository.listByInviter(guildId, inviterId, skip, limit),
    ]);
    return {
        total,
        rows: rows.map(r => ({
            inviteeId: r.inviteeId,
            joinedAt: r.joinedAt.toISOString(),
            leftAt: r.leftAt ? r.leftAt.toISOString() : null,
            fake: Boolean(r.fake),
        })),
    };
}
