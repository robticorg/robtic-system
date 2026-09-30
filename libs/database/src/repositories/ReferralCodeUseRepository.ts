import { ReferralCodeUse, type IReferralCodeUse } from "@database/models/ReferralCodeUse";

export class ReferralCodeUseRepository {
    static async find(guildId: string, discordId: string): Promise<IReferralCodeUse | null> {
        return ReferralCodeUse.findOne({ guildId, discordId });
    }

    /**
     * Links the member to a code, replacing any previous link. Only called after
     * `applyReferralCode` has decided a replacement is allowed (no link, or a link to a deleted code).
     */
    static async set(guildId: string, discordId: string, codeId: string, appliedAt: Date): Promise<void> {
        await ReferralCodeUse.updateOne(
            { guildId, discordId },
            { $set: { codeId, appliedAt } },
            { upsert: true }
        );
    }

    /** Staff reset: the member no longer has a code and may apply one again. Returns whether one existed. */
    static async clear(guildId: string, discordId: string): Promise<boolean> {
        const result = await ReferralCodeUse.deleteOne({ guildId, discordId });
        return result.deletedCount > 0;
    }

    /** How many members are linked to a code (active or not). */
    static async countByCode(codeId: string): Promise<number> {
        return ReferralCodeUse.countDocuments({ codeId });
    }
}
