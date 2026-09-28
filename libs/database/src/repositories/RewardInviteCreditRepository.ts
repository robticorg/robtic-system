import { RewardInviteCredit } from "@database/models/RewardInviteCredit";

export class RewardInviteCreditRepository {
    /**
     * Creates the credit row. Returns `false` rather than throwing when the invitee already has
     * one for this guild — the unique index on `{guildId, inviteeId}` is what makes a rejoin (or a
     * duplicate join event) a safe no-op instead of a second credit.
     */
    static async credit(
        guildId: string,
        inviterId: string,
        inviteeId: string,
        inviteCode: string,
        joinedAt: Date,
        expiresAt: Date,
    ): Promise<boolean> {
        try {
            await RewardInviteCredit.create({ guildId, inviterId, inviteeId, inviteCode, joinedAt, expiresAt, leftAt: null });
            return true;
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return false;
            throw err;
        }
    }

    /**
     * Currently valid invites credited to one inviter: unexpired, and the invitee still in the
     * guild. Feeds directly into the +1%/invite bonus. Mirrors `isInviteCreditActive` in
     * `libs/core/src/rewards/invite-credit.ts`.
     */
    static async countActive(guildId: string, inviterId: string, now: Date): Promise<number> {
        return RewardInviteCredit.countDocuments({ guildId, inviterId, expiresAt: { $gt: now }, leftAt: null });
    }

    /** The invitee left: their credit stops counting. The row stays, so a rejoin cannot be credited again. */
    static async markLeft(guildId: string, inviteeId: string, at: Date): Promise<void> {
        await RewardInviteCredit.updateOne({ guildId, inviteeId, leftAt: null }, { $set: { leftAt: at } });
    }

    /** The invitee came back: the original credit resumes under its original `expiresAt`. Returns whether one existed. */
    static async markRejoined(guildId: string, inviteeId: string): Promise<boolean> {
        const result = await RewardInviteCredit.updateOne({ guildId, inviteeId }, { $set: { leftAt: null } });
        return result.matchedCount > 0;
    }
}
