import type { LogKey } from "./log-registry";

export type ActivityLogChannel =
    | "xp_gain"
    | "rewards"
    | "support_points"
    | "staff_activity"
    | "decay"
    | "ai";

/** Maps each community activity-log stream to its configured log channel key. */
export const ACTIVITY_LOG_KEY_MAP: Record<ActivityLogChannel, LogKey> = {
    xp_gain: "xp_gain_log",
    rewards: "rewards_log",
    support_points: "support_points_log",
    staff_activity: "staff_activity_log",
    decay: "decay_log",
    ai: "ai_log",
};
