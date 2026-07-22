/** Which bot subsystem a config write targets. */
export type AdminConfigSection = "server" | "xp" | "streak" | "combo" | "punish" | "logs";

export interface AdminServerConfig {
    prefix: string | null;
    commandsChannelId: string | null;
    modmailChannelId: string | null;
    roles: {
        members: string | null;
        bots: string | null;
        en: string | null;
        ar: string | null;
    };
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
    /** Log-registry key → channel id (or null when unset). */
    channels: Record<string, string | null>;
}

/** The full editable config surface for one guild. */
export interface AdminConfigSnapshot {
    server: AdminServerConfig;
    xp: AdminXpConfig;
    streak: AdminStreakConfig;
    combo: AdminComboConfig;
    punish: AdminPunishConfig;
    logs: AdminLogsConfig;
}

/** Per-section payload shapes for a config write. */
export interface AdminConfigUpdate {
    server: AdminServerConfig;
    xp: AdminXpConfig;
    streak: AdminStreakConfig;
    combo: AdminComboConfig;
    punish: AdminPunishConfig;
    logs: AdminLogsConfig;
}
