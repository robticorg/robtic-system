import { xpIncrementForLevel } from "./xp-increment-for-level";

/** Cumulative XP required to reach `level` from 0. */
export function xpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i <= level; i++) total += xpIncrementForLevel(i);
    return total;
}
