/**
 * Channel names expected inside a per-source-guild category in the centralized
 * "server log guild" (see /set-log-guild). `sendToServerLog(client, guildId, name, embed)`
 * looks up a channel with one of these names under the category named after `guildId`.
 * Single source of truth — the auto-provisioning on guild join and the /set-log-guild
 * help text both read from this list instead of keeping their own copy.
 */
export const SERVER_LOG_CHANNELS = [
    "member-join",
    "member-leave",
    "member-role-update",
    "role-create",
    "role-delete",
    "role-update",
    "channel-create",
    "channel-delete",
    "channel-update",
    "message-delete",
    "message-update",
] as const;
