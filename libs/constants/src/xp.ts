export const XP_CONFIG = {
    minPerMessage: 5,
    maxPerMessage: 15,
    cooldownMs: 60_000,
    /** XP cost of level 1. Each subsequent level costs levelGrowthRate times the previous level's cost. */
    levelBaseXP: 100,
    levelGrowthRate: 1.2,
} as const;

/** Gate for the "real message" counter (/top Messages, ActivityXP.realMessageCount) — counts everywhere, not just XP channels. */
export const MESSAGE_STATS_CONFIG = {
    minMessageLength: 5,
} as const;

export const DECAY_CONFIG = {
    inactiveDaysThreshold: 7,
    baseXPLoss: 10,
    accelerationPerDay: 5,
    maxDailyLoss: 100,
    checkIntervalMs: 3_600_000,
} as const;
