import { xpIncrementForLevel } from "./xp-increment-for-level";

export function calculateLevel(totalXP: number): number {
    let level = 0;
    let cumulative = 0;
    while (true) {
        const next = cumulative + xpIncrementForLevel(level + 1);
        if (next > totalXP) return level;
        cumulative = next;
        level++;
    }
}
