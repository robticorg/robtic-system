import { InviteJoin, type IInviteJoin, type InviteJoinSource } from "@database/models/InviteJoin";

export interface InviterJoinCounts {
    joins: number;
    leaves: number;
    /** Joins at or after the `since` passed to `countsFor`. */
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
    }): Promise<boolean> {
        try {
            await InviteJoin.create({ ...entry, leftAt: null });
            return true;
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return false;
            throw err;
        }
    }

    /** The member left — closes their most recent open join. */
    static async markLeft(guildId: string, inviteeId: string, at: Date): Promise<void> {
        await InviteJoin.findOneAndUpdate(
            { guildId, inviteeId, leftAt: null },
            { $set: { leftAt: at } },
            { sort: { joinedAt: -1 } }
        );
    }

    static async countsFor(guildId: string, inviterId: string, since: Date): Promise<InviterJoinCounts> {
        const [joins, leaves, recentJoins] = await Promise.all([
            InviteJoin.countDocuments({ guildId, inviterId }),
            InviteJoin.countDocuments({ guildId, inviterId, leftAt: { $ne: null } }),
            InviteJoin.countDocuments({ guildId, inviterId, joinedAt: { $gte: since } }),
        ]);
        return { joins, leaves, recentJoins };
    }

    static async countByInviter(guildId: string, inviterId: string): Promise<number> {
        return InviteJoin.countDocuments({ guildId, inviterId });
    }

    /** One page of an inviter's joins, newest first. */
    static async listByInviter(guildId: string, inviterId: string, skip: number, limit: number): Promise<IInviteJoin[]> {
        return InviteJoin.find({ guildId, inviterId }).sort({ joinedAt: -1 }).skip(skip).limit(limit);
    }
}
