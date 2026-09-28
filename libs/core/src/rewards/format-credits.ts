import { CREDITS_DISPLAY } from "@constants";

/**
 * The isolation layer between the internal integer wallet unit and the user-facing "Credits"
 * label. Nothing else should assume the ratio or read `CREDITS_DISPLAY` directly — changing either
 * later is an edit here, not a hunt through every place a balance is shown.
 */

/** Internal wallet units → the displayed Credits amount, e.g. `5` → `5_000_000`. */
export function unitsToCredits(units: number): number {
    return units * CREDITS_DISPLAY.displayScale;
}

function trimmed(value: number): string {
    return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function scaled(amount: number): string {
    if (amount >= 1_000_000) return `${trimmed(amount / 1_000_000)}M`;
    if (amount >= 1_000) return `${trimmed(amount / 1_000)}K`;
    return `${amount}`;
}

/** `5` internal units → `"5M Credits"`. Never exposes the internal unit or its number as-is. */
export function formatCredits(units: number): string {
    return `${scaled(unitsToCredits(units))} ${CREDITS_DISPLAY.currencyLabel}`;
}
