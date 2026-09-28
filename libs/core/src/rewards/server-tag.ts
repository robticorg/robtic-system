/**
 * The minimal shape of Discord's own "Server Tag" data (`User.primaryGuild` in discord.js) this
 * bonus needs. Declared locally, structurally compatible with discord.js's `UserPrimaryGuild`,
 * rather than imported — `libs/core` stays discord.js-free, the same way `resolveRewardBonuses`
 * takes plain `roleIds` instead of a `GuildMember`.
 */
export interface PrimaryGuildIdentity {
    identityEnabled: boolean | null;
    identityGuildId: string | null;
}

/**
 * Whether a member currently has *this* guild's Server Tag displayed, right now.
 *
 * There is no tracking table for the on/off state itself — it reads Discord's own live state
 * (`member.user.primaryGuild`) fresh on every call, the same fact the Discord client itself shows
 * next to the member's name. A member who removes their tag stops matching on the very next read;
 * turning it back on matches again immediately. Nothing here remembers a past answer, so there is
 * nothing to invalidate when it changes.
 *
 * This alone is *not* enough to grant the reward bonus — see `server-tag-presence.ts` for the
 * 6-continuous-hour requirement layered on top, which is the only part of Server Tag that needs
 * any persistence at all.
 */
export function isServerTagActive(
    primaryGuild: PrimaryGuildIdentity | null | undefined,
    guildId: string,
): boolean {
    return Boolean(primaryGuild?.identityEnabled) && primaryGuild?.identityGuildId === guildId;
}
