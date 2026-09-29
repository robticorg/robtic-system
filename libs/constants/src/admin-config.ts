/**
 * Every writable config section, in one place.
 *
 * The API validates an incoming section against this and `AdminConfigSection` is derived from it,
 * so the two cannot drift.
 */
export const ADMIN_CONFIG_SECTIONS = [
    "server",
    "xp",
    "streak",
    "combo",
    "punish",
    "logs",
    "points",
    "voice",
    "features",
] as const;
