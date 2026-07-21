const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";

/**
 * Exchanges an Embedded App authorization code for an access token.
 * The client secret never leaves this process — the Activity only ever sees the resulting token.
 */
export async function exchangeToken(request: Request): Promise<Response> {
    const { code } = await request.json().catch(() => ({})) as { code?: string };
    if (!code) {
        return Response.json({ error: "code is required" }, { status: 400 });
    }

    const response = await fetch(DISCORD_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: process.env.DISCORD_CLIENT_ID ?? "",
            client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
            grant_type: "authorization_code",
            code,
        }),
    });

    if (!response.ok) {
        return Response.json({ error: "token exchange failed" }, { status: 502 });
    }

    const { access_token } = await response.json() as { access_token: string };
    return Response.json({ access_token });
}
