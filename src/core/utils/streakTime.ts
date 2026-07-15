import { STREAK_CONFIG } from "@core/config";

const DAY_MS = 24 * 60 * 60 * 1000;

const CLAIM_DAYS = Math.max(1, Math.round(STREAK_CONFIG.claimWindowMs / DAY_MS));
const EXPIRE_DAYS = Math.max(1, Math.round(STREAK_CONFIG.expireWindowMs / DAY_MS));

function utcDayStart(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** UTC midnight at which a new claim becomes available (day after lastIncrement's calendar day). */
export function nextClaimAt(lastIncrement: Date): Date {
    return new Date(utcDayStart(lastIncrement) + CLAIM_DAYS * DAY_MS);
}

/** UTC midnight at which the streak expires if no claim is made by then. */
export function streakExpiresAt(lastIncrement: Date): Date {
    return new Date(utcDayStart(lastIncrement) + EXPIRE_DAYS * DAY_MS);
}

export function isClaimable(lastIncrement: Date, now: Date = new Date()): boolean {
    return now.getTime() >= nextClaimAt(lastIncrement).getTime();
}

export function isStreakExpired(lastIncrement: Date, now: Date = new Date()): boolean {
    return now.getTime() >= streakExpiresAt(lastIncrement).getTime();
}
