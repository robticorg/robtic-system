/** The invites feature (`/invites`, `/info`, join announcements). Reward numbers live in `rewards.ts`. */
export const INVITES_CONFIG = {
    /** Invited members listed per `/info` page. */
    infoPageSize: 10,
    /** What "this week" means on `/invites`: a rolling window, the same length as an invite credit's life. */
    recentWindowDays: 7,
    /**
     * A rejoin within this many days of the member's last *real* join is fake, whoever invited them.
     * Once the window has passed the next join is real again and starts a fresh window.
     */
    fakeWindowDays: 30,
    /** The ticket bot. Channels it creates named `ticketChannelPrefix…` accept bare `info` / `invites`. */
    ticketBotId: "1547206687021076560",
    ticketChannelPrefix: "ticket-",
} as const;
