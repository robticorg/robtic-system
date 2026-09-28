/** The invites feature (`/invites`, `/info`, join announcements). Reward numbers live in `rewards.ts`. */
export const INVITES_CONFIG = {
    /** Invited members listed per `/info` page. */
    infoPageSize: 10,
    /** What "this week" means on `/invites`: a rolling window, the same length as an invite credit's life. */
    recentWindowDays: 7,
} as const;
