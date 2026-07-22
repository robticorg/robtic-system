import { DAY_MS } from "@constants";
import { CLAIM_DAYS } from "./streak-windows";
import { utcDayStart } from "./utc-day-start";

/** UTC midnight at which a new claim becomes available (day after lastIncrement's calendar day). */
export function nextClaimAt(lastIncrement: Date): Date {
    return new Date(utcDayStart(lastIncrement) + CLAIM_DAYS * DAY_MS);
}
