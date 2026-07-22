export type AuditChannelKey =
    | "member_join"
    | "member_leave"
    | "member_kick"
    | "member_ban"
    | "message_delete"
    | "channel_create"
    | "channel_delete"
    | "role_update"
    /** Catch-all destination for events without their own channel. */
    | "generic";

export type SecurityEventType =
    | "kick"
    | "ban"
    | "role_grant"
    | "role_remove"
    | "channel_create"
    | "channel_delete";

export type SecurityActionType = "kick" | "ban" | "remove_role" | "send_alert";

export interface ModerationAuditSettings {
    auditChannels: Record<AuditChannelKey, string>;
    securityLogChannelId: string;
    rolesToStrip: string[];
}

/** One "N events within a window triggers these actions" threshold. */
export interface SecurityRule {
    event: SecurityEventType;
    limit: number;
    windowMs: number;
    actions: SecurityActionType[];
}

export interface ModerationSecurityConfig {
    enabled: boolean;
    rules: SecurityRule[];
    whitelistUserIds: string[];
    whitelistRoleIds: string[];
    settings: ModerationAuditSettings;
}
