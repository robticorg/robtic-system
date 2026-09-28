import { RewardBoosterState, type IRewardBoosterState } from "@database/models/RewardBoosterState";

/**
 * Backs the Booster reward bonus. Nothing here decides anything — the transitions (start, count
 * change, stop, reconciliation) are pure functions in `libs/core/src/rewards/booster-state.ts`,
 * which hand this repository the finished state to persist.
 */
export class RewardBoosterStateRepository {
    static async get(guildId: string, discordId: string): Promise<IRewardBoosterState | null> {
        return RewardBoosterState.findOne({ guildId, discordId });
    }

    /** Every member currently tracked as boosting in one guild — boosters only, so always small. */
    static async listByGuild(guildId: string): Promise<IRewardBoosterState[]> {
        return RewardBoosterState.find({ guildId });
    }

    /** Writes the member's current boost state, creating the row if they had none. */
    static async save(guildId: string, discordId: string, boostCount: number, continuousStartedAt: Date): Promise<void> {
        await RewardBoosterState.updateOne(
            { guildId, discordId },
            { $set: { boostCount, continuousStartedAt } },
            { upsert: true }
        );
    }

    /** The member stopped boosting (or left) — deletes the row so the next boost starts a fresh window. */
    static async clear(guildId: string, discordId: string): Promise<void> {
        await RewardBoosterState.deleteOne({ guildId, discordId });
    }
}
