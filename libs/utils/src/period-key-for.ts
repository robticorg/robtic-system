import type { ComboLeaderboardPeriod } from "@constants";
import { utcDateKey } from "./utc-date-key";
import { utcWeekKey } from "./utc-week-key";
import { utcMonthKey } from "./utc-month-key";

export function periodKeyFor(period: ComboLeaderboardPeriod, date: Date): string {
    switch (period) {
        case "daily": return utcDateKey(date);
        case "weekly": return utcWeekKey(date);
        case "monthly": return utcMonthKey(date);
        case "alltime": return "all";
    }
}
