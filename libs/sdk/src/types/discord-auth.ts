import type { DiscordSDK } from "@discord/embedded-app-sdk";

/** Result of a completed authenticate() handshake: user, scopes, and access token. */
export type DiscordAuth = Awaited<ReturnType<DiscordSDK["commands"]["authenticate"]>>;

/** Auth result plus the frame context the Activity was launched in. */
export interface DiscordSession {
    auth: DiscordAuth;
    /** Null when the Activity was launched outside a guild (e.g. a DM call). */
    guildId: string | null;
    channelId: string | null;
}
