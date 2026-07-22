import { XP_CONFIG } from "@constants";

/** XP cost of going from level-1 to level (level 1 = levelBaseXP, each level after costs levelGrowthRate times more). */
export function xpIncrementForLevel(level: number): number {
    return Math.round(XP_CONFIG.levelBaseXP * Math.pow(XP_CONFIG.levelGrowthRate, level - 1));
}
