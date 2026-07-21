import { exchangeToken } from "./routes/exchange-token";

const port = Number(process.env.API_PORT ?? 3001);

if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
    console.warn("[api] DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET are not set — /api/token will fail");
}

Bun.serve({
    port,
    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === "POST" && url.pathname === "/api/token") {
            return exchangeToken(request);
        }
        if (url.pathname === "/api/health") {
            return Response.json({ status: "ok" });
        }

        return new Response("Not Found", { status: 404 });
    },
});

console.log(`[api] listening on http://localhost:${port}`);
