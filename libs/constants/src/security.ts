/** How far back an audit-log entry may be and still be attributed to the event we just saw. */
export const AUDIT_ENTRY_MAX_AGE_MS = 15_000;

/** How many recent audit-log entries to scan when attributing an event. */
export const AUDIT_ENTRY_FETCH_LIMIT = 6;

/** Truncation sizes for user content echoed into security embeds. */
export const SECURITY_CONTENT_TRUNCATE = {
    default: 900,
    embedField: 1024,
} as const;

/** Matches a raw Discord snowflake inside embed field text. */
export const SNOWFLAKE_IN_TEXT_REGEX = /\d{16,20}/;

/** Embed field names that identify the actor / target of an audited action. */
export const AUDIT_ACTOR_FIELD_REGEX = /executor|moderator|author|by/i;
export const AUDIT_TARGET_FIELD_REGEX = /target|user|member/i;
