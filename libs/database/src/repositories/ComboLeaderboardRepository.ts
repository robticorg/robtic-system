import { ComboLeaderboardEntry, type IComboLeaderboardEntry } from "@database/models/ComboLeaderboardEntry";
import type { ComboLeaderboardPeriod, ComboLeaderboardType } from "@core/config";

export interface ComboLeaderboardUpsert {
    guildId: string;
    period: ComboLeaderboardPeriod;
    periodKey: string;
    type: ComboLeaderboardType;
    discordId: string;
    value: number;
}

export class ComboLeaderboardRepository {
    /** Batches many conditional-max upserts into a single round trip — used by the periodic sweep, never per-message. */
    static async bulkUpsertMax(entries: ComboLeaderboardUpsert[]): Promise<void> {
        if (entries.length === 0) return;

        await ComboLeaderboardEntry.bulkWrite(
            entries.map(entry => ({
                updateOne: {
                    filter: {
                        guildId: entry.guildId,
                        period: entry.period,
                        periodKey: entry.periodKey,
                        type: entry.type,
                        discordId: entry.discordId,
                    },
                    update: { $max: { value: entry.value } },
                    upsert: true,
                },
            })),
            { ordered: false }
        );
    }

    static async getTop(
        guildId: string,
        period: ComboLeaderboardPeriod,
        periodKey: string,
        type: ComboLeaderboardType,
        limit: number,
    ): Promise<IComboLeaderboardEntry[]> {
        return ComboLeaderboardEntry.find({ guildId, period, periodKey, type })
            .sort({ value: -1 })
            .limit(limit);
    }
}
