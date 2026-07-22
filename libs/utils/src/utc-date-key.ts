/** UTC calendar day key, e.g. "2026-07-15". */
export function utcDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}
