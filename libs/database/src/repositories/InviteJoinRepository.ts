import { InviteJoin, type IInviteJoin, type InviteJoinSource } from "@database/models/InviteJoin";

/** Rows written before `fake` existed have no field at all, so "real" is `$ne: true`, not `false`. */
const REAL = { fake: { $ne: true } } as const;

export interface InviterJoinCounts {
    /** Real joins. */
    joins: number;
    /** Real joins that have since left. */
    leaves: number;
    /** Rejoins inside the fake window — shown, never credited. */
    fakes: number;
    /** Real joins at or after the `since` passed to `countsFor` that are still in the server. */
    recentJoins: number;
}

export class InviteJoinRepository {
    /** Records one join. Returns `false` for a replay of a join already recorded. */
    static async record(entry: {
        guildId: string;
        inviteeId: string;
        inviterId: string | null;
        inviteCode: string | null;
        source: InviteJoinSource;
        joinedAt: Date;
        fake: boolean;
    }): Promise<boolean> {
        try {
            await InviteJoin.create({ ...entry, leftAt: null });
            return true;
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return false;
            throw err;
        }
    }

    /** Whether the member has a real join at or after `since` — i.e. whether a join now would be fake. */
    static async hasRealJoinSince(guildId: string, inviteeId: string, since: Date): Promise<boolean> {
        return (await InviteJoin.exists({ guildId, inviteeId, ...REAL, joinedAt: { $gte: since } })) !== null;
    }

    /** The member left — closes their most recent open join and returns it (`null` if none was open). */
    static async markLeft(guildId: string, inviteeId: string, at: Date): Promise<IInviteJoin | null> {
        return InviteJoin.findOneAndUpdate(
            { guildId, inviteeId, leftAt: null },
            { $set: { leftAt: at } },
            { sort: { joinedAt: -1 } }
        );
    }

    static async countsFor(guildId: string, inviterId: string, since: Date): Promise<InviterJoinCounts> {
        const [joins, leaves, fakes, recentJoins] = await Promise.all([
            InviteJoin.countDocuments({ guildId, inviterId, ...REAL }),
            InviteJoin.countDocuments({ guildId, inviterId, ...REAL, leftAt: { $ne: null } }),
            InviteJoin.countDocuments({ guildId, inviterId, fake: true }),
            InviteJoin.countDocuments({ guildId, inviterId, ...REAL, leftAt: null, joinedAt: { $gte: since } }),
        ]);
        return { joins, leaves, fakes, recentJoins };
    }

    static async countByInviter(guildId: string, inviterId: string): Promise<number> {
        return InviteJoin.countDocuments({ guildId, inviterId });
    }

    /** One page of an inviter's joins, newest first. */
    static async listByInviter(guildId: string, inviterId: string, skip: number, limit: number): Promise<IInviteJoin[]> {
        return InviteJoin.find({ guildId, inviterId }).sort({ joinedAt: -1 }).skip(skip).limit(limit);
    }
}
