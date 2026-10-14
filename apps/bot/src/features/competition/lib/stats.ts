import type { Client } from "discord.js";
import { InviteJoin } from "@database/models/InviteJoin";
import { InviteJoinRepository } from "@database/repositories";
import { inviteTotal } from "@core/invites";
import { CompetitionVote, type ICompetitionEntry } from "./models";

/**
 * Votes and invites, read from the main bot's invite history (`InviteJoin`) — the competition bot
 * itself has no member list. Who is still in the server comes from the main bot, which has the
 * GuildMembers intent; without it, a voter's last join record (`leftAt`) decides.
 */

let mainClient: Client | null = null;

export function setMainClient(client: Client): void {
    mainClient = client;
}

/** The ids in `ids` that are members of the guild right now. */
async function presentIds(guildId: string, ids: string[]): Promise<Set<string> | null> {
    const guild = mainClient?.guilds.cache.get(guildId);
    if (!guild) return null;
    const present = new Set<string>();
    try {
        for (let i = 0; i < ids.length; i += 100) {
            const members = await guild.members.fetch({ user: ids.slice(i, i + 100) });
            for (const id of members.keys()) present.add(id);
        }
        return present;
    } catch {
        return null;
    }
}

interface VoterInfo {
    invitedBy: string | null;
    fake: boolean;
    present: boolean;
}

/** For each voter: who invited them (their latest join), whether that join was fake, and whether they are still here. */
async function describeVoters(guildId: string, voterIds: string[]): Promise<Map<string, VoterInfo>> {
    const latest = new Map<string, { inviterId: string | null; fake: boolean; leftAt: Date | null }>();
    if (voterIds.length) {
        const joins = await InviteJoin.find({ guildId, inviteeId: { $in: voterIds } }).sort({ joinedAt: -1 }).lean();
        for (const j of joins) {
            if (!latest.has(j.inviteeId)) latest.set(j.inviteeId, { inviterId: j.inviterId, fake: Boolean(j.fake), leftAt: j.leftAt });
        }
    }
    const present = await presentIds(guildId, voterIds);

    return new Map(voterIds.map(id => {
        const join = latest.get(id);
        return [id, {
            invitedBy: join?.inviterId ?? null,
            fake: join?.fake ?? false,
            present: present ? present.has(id) : !join?.leftAt,
        }];
    }));
}

export interface InviteSummary {
    /** Joins minus leaves, fakes excluded — what `/invites` shows. */
    invites: number;
    fakes: number;
}

export async function inviteSummary(guildId: string, userId: string): Promise<InviteSummary> {
    const counts = await InviteJoinRepository.countsFor(guildId, userId, new Date());
    return { invites: inviteTotal(counts), fakes: counts.fakes };
}

export interface EntryCheck extends InviteSummary {
    total: number;
    fromInvited: number;
    fromOthers: number;
    /** Votes left after dropping voters whose join was fake and voters who left. */
    real: number;
    /** Votes from voters still in the server. */
    current: number;
}

/** `!check #N` — every number about one participant. */
export async function checkEntry(entry: Pick<ICompetitionEntry, "guildId" | "number" | "userId">): Promise<EntryCheck> {
    const votes = await CompetitionVote.find({ guildId: entry.guildId, number: entry.number }).lean();
    const voterIds = votes.map(v => v.voterId);
    const [voters, invites] = await Promise.all([describeVoters(entry.guildId, voterIds), inviteSummary(entry.guildId, entry.userId)]);

    let fromInvited = 0, real = 0, current = 0;
    for (const info of voters.values()) {
        if (info.invitedBy === entry.userId) fromInvited++;
        if (info.present) current++;
        if (info.present && !info.fake) real++;
    }
    return { ...invites, total: voterIds.length, fromInvited, fromOthers: voterIds.length - fromInvited, real, current };
}

export interface LeaderboardRow {
    number: number;
    userId: string;
    votes: number;
    invites: number;
}

/** Top 10 by current votes (voters still in the server); invites break ties. */
export async function leaderboardRows(guildId: string, entries: Pick<ICompetitionEntry, "number" | "userId">[]): Promise<LeaderboardRow[]> {
    const votes = await CompetitionVote.find({ guildId }).lean();
    const voters = await describeVoters(guildId, votes.map(v => v.voterId));

    const current = new Map<number, number>();
    for (const v of votes) {
        if (voters.get(v.voterId)?.present) current.set(v.number, (current.get(v.number) ?? 0) + 1);
    }

    const rows = await Promise.all(entries.map(async e => ({
        number: e.number,
        userId: e.userId,
        votes: current.get(e.number) ?? 0,
        invites: (await inviteSummary(guildId, e.userId)).invites,
    })));
    return rows.sort((a, b) => b.votes - a.votes || b.invites - a.invites || a.number - b.number).slice(0, 10);
}
