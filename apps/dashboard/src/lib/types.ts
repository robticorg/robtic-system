/**
 * The shapes the API returns.
 *
 * Hand-written rather than imported from apps/dashboard-api: the dashboard is compiled by Next.js
 * with its own tsconfig and must not pull a Nest module — importing a controller would drag
 * mongoose and the whole database layer into the browser bundle's dependency graph.
 *
 * They are kept in step by the API's own DTO tests; if one drifts, the fix belongs here.
 */

export interface SessionUser {
    id: string;
    username: string;
    avatar: string | null;
}

export interface GuildSummary {
    id: string;
    name: string;
    icon: string | null;
    owner: boolean;
}

export interface DiscordRole {
    id: string;
    name: string;
    color: number;
    position: number;
}

export interface DiscordChannel {
    id: string;
    name: string;
    type: number;
    position: number;
}

export interface GuildDirectory {
    roles: DiscordRole[];
    channels: DiscordChannel[];
}

export interface GuildSettings {
    prefix: string | null;
    commandsChannelId: string | null;
    botAdminRoleIds: string[];
    features: Array<{
        key: string;
        description: string;
        commands: string[];
        enabled: boolean;
        overridden: boolean;
    }>;
    staffTiers: Array<{ key: string; score: number; roleIds: string[] }>;
    commandAccess: Array<{ commandName: string; allowedRoleIds: string[]; allowedCategoryKeys: string[] }>;
}

export interface ModerationCase {
    caseId: string;
    type: "warn" | "mute" | "tempban" | "ban" | "kick";
    userId: string;
    moderatorId: string;
    reason: string;
    active: boolean;
    createdAt: string;
    expiresAt: string | null;
}

export interface AuditEntry {
    eventName: string;
    source: string;
    actorId: string | null;
    targetId: string | null;
    channelId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}
