import { streakExpiresAt } from "./streak-expires-at";

export function isStreakExpired(lastIncrement: Date, now: Date = new Date()): boolean {
    return now.getTime() >= streakExpiresAt(lastIncrement).getTime();
}
