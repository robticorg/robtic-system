import { RewardTransaction, type IRewardTransaction, type RewardTransactionType } from "@database/models/RewardTransaction";

export interface RewardTotals {
    earned: number;
    spent: number;
    withdrawn: number;
    /** Earned, broken down by where it came from. */
    byType: Record<string, number>;
}

export class RewardTransactionRepository {
    static async recent(guildId: string, discordId: string, limit = 10): Promise<IRewardTransaction[]> {
        return RewardTransaction.find({ guildId, discordId }).sort({ createdAt: -1 }).limit(limit);
    }

    /**
     * Lifetime totals for one member, aggregated in the database rather than in memory — mirrors
     * `PointHistoryRepository.totals`, for the same reason: a long-lived ledger is thousands of
     * rows and none of them need to travel to compute a sum.
     */
    static async totals(guildId: string, discordId: string): Promise<RewardTotals> {
        const rows = await RewardTransaction.aggregate<{ _id: RewardTransactionType; total: number }>([
            { $match: { guildId, discordId } },
            { $group: { _id: "$type", total: { $sum: "$amount" } } },
        ]);

        const totals: RewardTotals = { earned: 0, spent: 0, withdrawn: 0, byType: {} };

        for (const row of rows) {
            if (row._id === "WITHDRAW") totals.withdrawn += Math.abs(row.total);
            else if (row.total < 0) totals.spent += Math.abs(row.total);
            else {
                totals.earned += row.total;
                totals.byType[row._id] = row.total;
            }
        }

        return totals;
    }
}
