import { RewardServerTagPresence } from "@database/models/RewardServerTagPresence";

/**
 * Backs the Server Tag reward bonus's 6-continuous-hour requirement. Nothing here decides
 * eligibility — that is `decideServerTagPresence` in `libs/core/src/rewards/server-tag-presence.ts`,
 * which is pure and takes whatever this repository read as a plain `Date | null`. This repository
 * only ever holds today's single timestamp per member, never a history.
 */
export class RewardServerTagPresenceRepository {
    static async getActiveSince(guildId: string, discordId: string, dayKey: string): Promise<Date | null> {
        const row = await RewardServerTagPresence.findOne({ guildId, discordId, dayKey });
        return row?.activeSince ?? null;
    }

    /**
     * Records the first moment today the tag was observed active. A no-op if today's row already
     * has one — `$setOnInsert` means a later call can never push the timestamp forward and reset
     * someone's progress toward the 6-hour window.
     */
    static async markActiveSince(guildId: string, discordId: string, dayKey: string, since: Date): Promise<void> {
        await RewardServerTagPresence.updateOne(
            { guildId, discordId, dayKey },
            { $setOnInsert: { activeSince: since } },
            { upsert: true }
        );
    }

    /** The tag was observed inactive — clears today's row so the next activation starts a fresh window. */
    static async clear(guildId: string, discordId: string, dayKey: string): Promise<void> {
        await RewardServerTagPresence.deleteOne({ guildId, discordId, dayKey });
    }
}
