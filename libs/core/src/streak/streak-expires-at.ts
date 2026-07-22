import { DAY_MS } from "@constants";
import { EXPIRE_DAYS } from "./streak-windows";
import { utcDayStart } from "./utc-day-start";

/** UTC midnight at which the streak expires if no claim is made by then. */
export function streakExpiresAt(lastIncrement: Date): Date {
    return new Date(utcDayStart(lastIncrement) + EXPIRE_DAYS * DAY_MS);
}
