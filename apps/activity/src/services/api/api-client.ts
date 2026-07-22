import type { LeaderboardResponse, Profile, SearchResult, TopCategory, TopPeriod } from "../../types/profile";
import type { AdminBootstrap, AdminConfigSection, AdminConfigSnapshot } from "../../types/admin";

/** Discord rewrites /.proxy to the backend in production; the Vite dev server proxies it locally. */
const API_BASE = "/.proxy/api";

let accessToken: string | null = null;
let guildId: string | null = null;

export function configureApi(token: string, currentGuildId: string | null): void {
    accessToken = token;
    guildId = currentGuildId;
}

async function request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    if (!accessToken) throw new Error("API called before authentication completed");
    if (!guildId) throw new Error("This Activity must be launched inside a server");

    const query = new URLSearchParams({ guildId, ...params });
    const response = await fetch(`${API_BASE}${path}?${query}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export function fetchOwnProfile(): Promise<Profile> {
    return request<Profile>("/profile");
}

export function fetchProfile(userId: string): Promise<Profile> {
    return request<Profile>(`/profile/${userId}`);
}

export async function searchUsers(query: string): Promise<SearchResult[]> {
    const { results } = await request<{ results: SearchResult[] }>("/search", { q: query });
    return results;
}

export function fetchLeaderboard(category: TopCategory, period: TopPeriod): Promise<LeaderboardResponse> {
    return request<LeaderboardResponse>("/top", { category, period });
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
    if (!accessToken) throw new Error("API called before authentication completed");
    if (!guildId) throw new Error("This Activity must be launched inside a server");

    const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ guildId, ...payload }),
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed with status ${response.status}`);
    }

    return response.json() as Promise<T>;
}

export function fetchAdminConfig(): Promise<AdminBootstrap> {
    return request<AdminBootstrap>("/admin/config");
}

export type ModerationAction = "ban" | "unban" | "kick" | "timeout" | "untimeout";

export async function moderateUser(payload: {
    action: ModerationAction;
    userId: string;
    reason?: string;
    durationHours?: number;
    deleteMessages?: boolean;
}): Promise<void> {
    await postJson<{ ok: true }>("/admin/moderate", payload);
}

export async function saveAdminSection<S extends AdminConfigSection>(
    section: S,
    values: AdminConfigSnapshot[S],
): Promise<AdminConfigSnapshot> {
    const { config } = await postJson<{ config: AdminConfigSnapshot }>("/admin/config", { section, values });
    return config;
}
