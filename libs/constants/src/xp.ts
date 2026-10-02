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

/**
 * XP decay, run separately for message XP and voice XP — each on its own inactivity clock, so a
 * member who chats but never joins voice only loses voice XP, and the other way round.
 *
 * Once a kind has been inactive for `inactiveDaysThreshold` days, it loses a percentage of its own
 * current XP once per day: `startBp` on the first decay day, `perDayBp` more each further day, never
 * above `maxBp`. Being a percentage, members with a lot of XP lose more and members with little lose
 * less. Basis points: 100 = 1%.
 */
export const DECAY_CONFIG = {
    inactiveDaysThreshold: 2,
    startBp: 100,
    perDayBp: 50,
    maxBp: 500,
    /** How often the scheduler looks; each member still decays at most once per day per kind. */
    checkIntervalMs: 3_600_000,
} as const;
