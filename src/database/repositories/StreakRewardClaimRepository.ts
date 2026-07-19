import { StreakRewardClaim, type IStreakRewardClaim } from "@database/models/StreakRewardClaim";

export class StreakRewardClaimRepository {
    /**
     * Attempts to record the "user was notified about this threshold" marker. Returns the created
     * record, or `null` if one already existed (duplicate key on the unique index) — the caller uses
     * that to decide whether to post the announcement, so a user can never be notified twice for the
     * same threshold even under concurrent streak-message processing.
     */
    static async tryCreateNotification(guildId: string, discordId: string, threshold: number): Promise<IStreakRewardClaim | null> {
        try {
            return await StreakRewardClaim.create({ guildId, discordId, threshold });
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return null;
            throw err;
        }
    }

    /** Atomic, guarded by `claimed: false` so two concurrent claim-button clicks can't both succeed. */
    static async markClaimed(guildId: string, discordId: string, threshold: number): Promise<IStreakRewardClaim | null> {
        return StreakRewardClaim.findOneAndUpdate(
            { guildId, discordId, threshold, claimed: false },
            { $set: { claimed: true, claimedAt: new Date() } },
            { returnDocument: "after" }
        );
    }

    static async find(guildId: string, discordId: string, threshold: number): Promise<IStreakRewardClaim | null> {
        return StreakRewardClaim.findOne({ guildId, discordId, threshold });
    }

    static async findForUser(guildId: string, discordId: string): Promise<IStreakRewardClaim[]> {
        return StreakRewardClaim.find({ guildId, discordId });
    }
}
