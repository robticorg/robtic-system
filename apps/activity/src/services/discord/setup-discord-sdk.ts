import { createDiscordSdk, authenticateUser, type DiscordSession } from "@robtic/sdk";
import { configureApi } from "../api/api-client";

const TOKEN_ENDPOINT = "/.proxy/api/token";

let sessionPromise: Promise<DiscordSession> | null = null;

/**
 * Boots the Embedded App SDK for this frame and completes the full auth handshake.
 * Memoized: Discord only allows one authorize flow per frame, and React StrictMode
 * double-mounts effects in dev — concurrent callers must share the same handshake.
 */
export function setupDiscordSdk(): Promise<DiscordSession> {
    if (!sessionPromise) {
        sessionPromise = runAuthFlow().catch((err: unknown) => {
            sessionPromise = null;
            throw err;
        });
    }
    return sessionPromise;
}

async function runAuthFlow(): Promise<DiscordSession> {
    const clientId = import.meta.env.VITE_DISCORD_CLIENT_ID;
    if (!clientId) {
        throw new Error("VITE_DISCORD_CLIENT_ID is not set — add it to the root .env");
    }

    const sdk = createDiscordSdk(clientId);
    const auth = await authenticateUser(sdk, clientId, TOKEN_ENDPOINT);

    const session: DiscordSession = {
        auth,
        guildId: sdk.guildId ?? null,
        channelId: sdk.channelId ?? null,
    };

    configureApi(auth.access_token, session.guildId);
    return session;
}
