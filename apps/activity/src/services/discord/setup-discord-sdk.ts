import { createDiscordSdk, authenticateUser, type DiscordAuth } from "@robtic/sdk";

const TOKEN_ENDPOINT = "/.proxy/api/token";

/** Boots the Embedded App SDK for this frame and completes the full auth handshake. */
export async function setupDiscordSdk(): Promise<DiscordAuth> {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    if (!clientId) {
        throw new Error("VITE_DISCORD_CLIENT_ID is not set — add it to the root .env");
    }

    const sdk = createDiscordSdk(clientId);
    return authenticateUser(sdk, clientId, TOKEN_ENDPOINT);
}
