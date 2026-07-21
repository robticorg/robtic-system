import type { ComboLeaderboardPeriod } from "@core/config";

/** UTC calendar day key, e.g. "2026-07-15". */
export function utcDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

/** ISO-8601 week key, e.g. "2026-W29" (Monday-start weeks, per the ISO week-date standard). */
export function utcWeekKey(date: Date): string {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** UTC calendar month key, e.g. "2026-07". */
export function utcMonthKey(date: Date): string {
    return date.toISOString().slice(0, 7);
}

export function periodKeyFor(period: ComboLeaderboardPeriod, date: Date): string {
    switch (period) {
        case "daily": return utcDateKey(date);
        case "weekly": return utcWeekKey(date);
        case "monthly": return utcMonthKey(date);
        case "alltime": return "all";
    }
}
