import type { ComboLeaderboardPeriod, TopCategory } from "@constants";

/** XP standing for one member of one guild. */
export interface ProfileXp {
    totalXP: number;
    level: number;
    /** XP earned inside the current level. */
    progress: number;
    /** XP needed to complete the current level. */
    needed: number;
    rank: number;
    messageCount: number;
}

export interface ProfileStreak {
    current: number;
    best: number;
    active: boolean;
    rank: number;
    bestRank: number;
    /** Milliseconds until the next claim is available; 0 when claimable now. */
    nextClaimMs: number;
    /** Milliseconds until the streak lapses, or null when there's no active streak. */
    expiresInMs: number | null;
}

export interface ProfileCombo {
    /** Live combo score, present only while a conversation is active. */
    activeScore: number | null;
    activePartnerId: string | null;
    activeLevel: string | null;
    bestScore: number;
    totalConversations: number;
    favoritePartnerId: string | null;
}

/** Everything the Activity's profile view renders for one user. */
export interface ProfileSnapshot {
    discordId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    /** True when the viewer isn't allowed to see the detail sections. */
    isPrivate: boolean;
    isSelf: boolean;
    xp: ProfileXp;
    streak: ProfileStreak;
    combo: ProfileCombo;
}

/** One row of the Activity's user-search autocomplete. */
export interface ProfileSearchResult {
    discordId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
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
}
