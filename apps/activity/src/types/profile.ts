export type TopCategory = "streak" | "combo" | "xp" | "messages";
export type TopPeriod = "daily" | "weekly" | "monthly" | "alltime";

export interface ProfilePartner {
    username: string;
    avatarUrl: string | null;
}

export interface Profile {
    discordId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isPrivate: boolean;
    isSelf: boolean;
    xp: {
        totalXP: number;
        level: number;
        progress: number;
        needed: number;
        rank: number;
        messageCount: number;
    };
    streak: {
        current: number;
        best: number;
        active: boolean;
        rank: number;
        bestRank: number;
        nextClaimMs: number;
        expiresInMs: number | null;
    };
    combo: {
        activeScore: number | null;
        activePartnerId: string | null;
        activeLevel: string | null;
        bestScore: number;
        totalConversations: number;
        favoritePartnerId: string | null;
    };
    partners: Record<string, ProfilePartner>;
}

export interface SearchResult {
    discordId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
}

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
    period: TopPeriod;
    rows: LeaderboardRow[];
    viewer: LeaderboardRow | null;
}
