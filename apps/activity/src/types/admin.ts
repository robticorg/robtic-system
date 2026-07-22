export type AdminConfigSection = "server" | "xp" | "streak" | "combo" | "punish" | "logs";

export interface AdminServerConfig {
    prefix: string | null;
    commandsChannelId: string | null;
    modmailChannelId: string | null;
    roles: { members: string | null; bots: string | null; en: string | null; ar: string | null };
}

export interface AdminXpConfig {
    chatChannels: string[];
    supportChannels: string[];
    staffChannels: string[];
    allowedRoles: string[];
    decayEnabled: boolean;
}

export interface AdminStreakConfig {
    channels: string[];
    remindersEnabled: boolean;
    minMessageLength: number;
}

export interface AdminComboConfig {
    championRoleId: string | null;
    minScorePerMessage: number | null;
    maxScorePerMessage: number | null;
}

export interface AdminPunishConfig {
    pointsPerAction: number;
    proofChannelId: string | null;
    shortcutRoleIds: string[];
}

export interface AdminLogsConfig {
    channels: Record<string, string | null>;
}

export interface AdminConfigSnapshot {
    server: AdminServerConfig;
    xp: AdminXpConfig;
    streak: AdminStreakConfig;
    combo: AdminComboConfig;
    punish: AdminPunishConfig;
    logs: AdminLogsConfig;
}

export interface GuildChannelInfo {
    id: string;
    name: string;
    type: number;
    parentId: string | null;
    position: number;
}

export interface GuildRoleInfo {
    id: string;
    name: string;
    color: number;
    position: number;
    managed: boolean;
}

export interface AdminBootstrap {
    isAdmin: boolean;
    config?: AdminConfigSnapshot;
    channels?: GuildChannelInfo[];
    roles?: GuildRoleInfo[];
}
