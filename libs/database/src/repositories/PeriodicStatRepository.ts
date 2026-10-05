import { PeriodicStat, type IPeriodicStat, type PeriodicStatMetric } from "@database/models/PeriodicStat";
import { COMBO_LEADERBOARD_PERIODS, type ComboLeaderboardPeriod } from "@constants";
import { periodKeyFor } from "@utils";

export class PeriodicStatRepository {
    /** Adds `amount` to every period bucket (daily/weekly/monthly/alltime) for one user's metric in one call. */
    static async incrementAllPeriods(guildId: string, metric: PeriodicStatMetric, discordId: string, amount: number, now = new Date()): Promise<void> {
        await PeriodicStat.bulkWrite(
            COMBO_LEADERBOARD_PERIODS.map(period => ({
                updateOne: {
                    filter: { guildId, period, periodKey: periodKeyFor(period, now), metric, discordId },
                    update: { $inc: { value: amount } },
                    upsert: true,
                },
            })),
            { ordered: false }
        );
    }

    /**
     * Adds a batched delta to one period bucket — at most once per flush batch. The upsert is
     * guarded on `flushBatch`: if this batch was already applied, the guarded filter misses, the
     * upsert collides with the unique index (E11000), and nothing changes. Returns whether it applied.
     */
    static async incrementBatch(
        guildId: string,
        period: ComboLeaderboardPeriod,
        periodKey: string,
        metric: PeriodicStatMetric,
        discordId: string,
        amount: number,
        batchId: string,
    ): Promise<boolean> {
        try {
            await PeriodicStat.updateOne(
                { guildId, period, periodKey, metric, discordId, flushBatch: { $ne: batchId } },
                { $inc: { value: amount }, $set: { flushBatch: batchId } },
                { upsert: true }
            );
            return true;
        } catch (err) {
            if ((err as { code?: number }).code === 11000) return false;
            throw err;
        }
    }

    /** Every member's all-time value for one metric, keyed `guildId:discordId` — one query, for migrations. */
    static async getAllTimeValues(metric: PeriodicStatMetric): Promise<Map<string, number>> {
        const rows = await PeriodicStat.find({ period: "alltime", periodKey: "all", metric }).select("guildId discordId value").lean();
        return new Map(rows.map(r => [`${r.guildId}:${r.discordId}`, r.value]));
    }

    static async getTop(
        guildId: string,
        period: ComboLeaderboardPeriod,
        metric: PeriodicStatMetric,
        limit: number,
        now = new Date(),
    ): Promise<IPeriodicStat[]> {
        return PeriodicStat.find({ guildId, period, periodKey: periodKeyFor(period, now), metric })
            .sort({ value: -1 })
            .limit(limit);
    }

    /** One member's figure for the current period. Zero when they have none, which is not an error. */
    static async getValue(
        guildId: string,
        period: ComboLeaderboardPeriod,
        metric: PeriodicStatMetric,
        discordId: string,
        now = new Date(),
    ): Promise<number> {
        const row = await PeriodicStat.findOne({
            guildId,
            period,
            periodKey: periodKeyFor(period, now),
            metric,
            discordId,
        });

        return row?.value ?? 0;
    }
}
