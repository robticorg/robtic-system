import type { DiscordSDK } from "@discord/embedded-app-sdk";

/** Result of a completed authenticate() handshake: user, scopes, and access token. */
export type DiscordAuth = Awaited<ReturnType<DiscordSDK["commands"]["authenticate"]>>;
