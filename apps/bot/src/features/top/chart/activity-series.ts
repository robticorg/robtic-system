import type { ComboLeaderboardPeriod } from "@constants";
import { GuildHourlyStatRepository, PeriodicStatRepository } from "@database/repositories";
import { periodKeyFor, utcDateKey } from "@utils";

const DAY_MS = 86_400_000;

export interface ActivitySeries {
    /** One point per hour (today), per day (week, month) or per month (all time). */
    points: number[];
    /** Axis labels, the same length as points (empty strings are skipped). */
    labels: string[];
    /** Messages in the whole period. */
    total: number;
    /** This period minus the one before; null for all time. */
    change: number | null;
}

const daysBack = (n: number, now: Date) => Array.from({ length: n }, (_, i) => new Date(now.getTime() - (n - 1 - i) * DAY_MS));

/** The server's messages over the period, for the chart under `/top`. */
export async function getActivitySeries(guildId: string, period: ComboLeaderboardPeriod, now = new Date()): Promise<ActivitySeries> {
    const sum = (p: ComboLeaderboardPeriod, keys: string[]) => PeriodicStatRepository.sumByKeys(guildId, p, "messages", keys);

    if (period === "daily") {
        const today = periodKeyFor("daily", now);
        const yesterday = periodKeyFor("daily", new Date(now.getTime() - DAY_MS));
        const [hours, totals] = await Promise.all([GuildHourlyStatRepository.getDay(guildId, utcDateKey(now)), sum("daily", [today, yesterday])]);
        const total = totals.get(today)!;
        return {
            points: hours,
            labels: hours.map((_, h) => (h % 3 === 0 ? `${String(h).padStart(2, "0")}:00` : "")),
            total,
            change: total - totals.get(yesterday)!,
        };
    }

    if (period === "weekly" || period === "monthly") {
        const span = period === "weekly" ? 7 : 30;
        const dates = daysBack(span, now);
        const keys = dates.map(d => periodKeyFor("daily", d));
        const current = periodKeyFor(period, now);
        const previous = periodKeyFor(period, period === "weekly" ? new Date(now.getTime() - 7 * DAY_MS) : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15)));
        const [days, totals] = await Promise.all([sum("daily", keys), sum(period, [current, previous])]);
        const step = period === "weekly" ? 1 : 5;
        return {
            points: keys.map(k => days.get(k)!),
            labels: keys.map((k, i) => (i % step === 0 || i === keys.length - 1 ? k.slice(5) : "")),
            total: totals.get(current)!,
            change: totals.get(current)! - totals.get(previous)!,
        };
    }

    const months = Array.from({ length: 12 }, (_, i) => periodKeyFor("monthly", new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + i, 15))));
    const [byMonth, all] = await Promise.all([sum("monthly", months), sum("alltime", ["all"])]);
    return {
        points: months.map(k => byMonth.get(k)!),
        labels: months.map((k, i) => (i % 2 === 0 || i === 11 ? k : "")),
        total: all.get("all")!,
        change: null,
    };
}
