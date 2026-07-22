import { nextClaimAt } from "./next-claim-at";

export function isClaimable(lastIncrement: Date, now: Date = new Date()): boolean {
    return now.getTime() >= nextClaimAt(lastIncrement).getTime();
}
