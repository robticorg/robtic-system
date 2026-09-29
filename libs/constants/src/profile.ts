/** Streak-badge tiers — must mirror the images/streak/fire<min>-<max>.png assets. */
export const BADGE_FIRE_RANGES = [
    { min: 1, max: 10 },
    { min: 11, max: 30 },
    { min: 31, max: 70 },
    { min: 71, max: 100 },
] as const;
