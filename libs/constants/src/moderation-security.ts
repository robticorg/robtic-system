import type { ModerationSecurityConfig, SecurityActionType } from "@typings/moderation-security";

/** Config-collection key prefix for a guild's moderation security settings. */
export const MOD_SECURITY_CONFIG_KEY_PREFIX = "moderation-security";

/** Every valid security response action, used to validate stored config. */
export const SECURITY_ACTION_TYPES: SecurityActionType[] = ["kick", "ban", "remove_role", "send_alert"];

/** Fallback window when a rule's window string can't be parsed. */
export const DEFAULT_SECURITY_WINDOW_MS = 60_000;

/** Smallest window a stored rule may specify. */
export const MIN_SECURITY_WINDOW_MS = 1_000;

/** `12h` / `30m` / `45s` / `2d` duration strings used by the security config commands. */
export const DURATION_SHORTHAND_REGEX = /^(\d+)\s*(s|m|h|d)?$/;

/** Milliseconds per duration-shorthand unit. */
export const DURATION_UNIT_MS = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
} as const;

export const DEFAULT_MODERATION_SECURITY_CONFIG: ModerationSecurityConfig = {
    enabled: false,
    rules: [],
    whitelistUserIds: [],
    whitelistRoleIds: [],
    settings: {
        auditChannels: {
            member_join: "",
            member_leave: "",
            member_kick: "",
            member_ban: "",
            message_delete: "",
            channel_create: "",
            channel_delete: "",
            role_update: "",
            generic: "",
        },
        securityLogChannelId: "",
        rolesToStrip: [],
    },
};
