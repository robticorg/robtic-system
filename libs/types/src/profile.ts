import type { ComboLeaderboardPeriod, TopCategory } from "@constants";

/** A small achievement badge rendered next to the profile name. */
export interface ProfileBadge {
    /** "fire<min>-<max>" streak tiers, or "top-combo" / "top-streak" for server #1s. */
    id: string;
    label: string;
}

/** One ranked row returned to the Activity's leaderboard view. */
export interface LeaderboardRow {
    discordId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    value: number;
    rank: number;
}

export interface LeaderboardResponse {
    category: TopCategory;
    period: ComboLeaderboardPeriod;
    rows: LeaderboardRow[];
    /** The viewer's own row, included even when outside the returned page. */
    viewer: LeaderboardRow | null;
    /** 1-based page of the ranking being returned. */
    page: number;
    pageSize: number;
    /** True when another page of ranked members exists after this one. */
    hasMore: boolean;
}
