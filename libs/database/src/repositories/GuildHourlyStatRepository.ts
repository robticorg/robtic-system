import { GuildHourlyStat } from "@database/models/GuildHourlyStat";

/** How long an hourly row is kept: the chart compares today with yesterday, so a week is plenty. */
const KEEP_MS = 8 * 86_400_000;

export class GuildHourlyStatRepository {
    /** Adds counts to one day's hours: `counts` is hour (0–23) → messages. */
    static async add(guildId: string, day: string, counts: ReadonlyMap<number, number>): Promise<void> {
        const inc: Record<string, number> = {};
        for (const [hour, n] of counts) inc[`hours.${hour}`] = n;
        if (!Object.keys(inc).length) return;
        const filter = { guildId, day };
        // The array has to exist before $inc can address its slots, so the first write of a day creates it.
        await GuildHourlyStat.updateOne(filter, { $setOnInsert: { hours: Array(24).fill(0), expiresAt: new Date(Date.parse(`${day}T00:00:00Z`) + KEEP_MS) } }, { upsert: true }).catch(err => {
            if ((err as { code?: number }).code !== 11000) throw err;
        });
        await GuildHourlyStat.updateOne(filter, { $inc: inc });
    }

    /** One day's 24 hours (zeros when there is no row). */
    static async getDay(guildId: string, day: string): Promise<number[]> {
        const row = await GuildHourlyStat.findOne({ guildId, day }, { hours: 1 }).lean();
        return Array.from({ length: 24 }, (_, i) => Number(row?.hours?.[i] ?? 0));
    }
}
