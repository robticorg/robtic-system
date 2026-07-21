import type { DiscordSDK } from "@discord/embedded-app-sdk";
import type { DiscordAuth } from "../types/discord-auth";

/**
 * Full Embedded App auth flow: wait for the frame handshake, request an OAuth2
 * authorization code from the Discord client, exchange it for an access token at
 * the backend (which holds the client secret), then authenticate the SDK session.
 */
export async function authenticateUser(
    sdk: DiscordSDK,
    clientId: string,
    tokenEndpoint: string,
): Promise<DiscordAuth> {
    await sdk.ready();

    const { code } = await sdk.commands.authorize({
        client_id: clientId,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: ["identify", "applications.commands"],
    });

    const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
    });
    if (!response.ok) {
        throw new Error(`Token exchange failed with status ${response.status}`);
    }

    const { access_token } = await response.json() as { access_token: string };
    return sdk.commands.authenticate({ access_token });
}
