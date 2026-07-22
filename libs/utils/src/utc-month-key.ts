/** UTC calendar month key, e.g. "2026-07". */
export function utcMonthKey(date: Date): string {
    return date.toISOString().slice(0, 7);
}
