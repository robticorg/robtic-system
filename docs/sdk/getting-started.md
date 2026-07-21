# Discord SDK — Getting Started

The starter is implemented: `apps/activity` (React + Vite client), `libs/sdk` (SDK wrapper), and `apps/api` (token exchange).

## 1. Discord Developer Portal

1. Create (or open) your application at <https://discord.com/developers/applications>.
2. Enable **Activities** for the application.
3. Under **OAuth2**, copy the **Client ID** and **Client Secret**.
4. Configure **URL Mappings** so `/` points at the activity host and `/api` at the API host (all Activity traffic is proxied through `discord.com/proxy`).

## 2. Environment

Fill these in the root `.env` (see `.env.example`):

```
VITE_DISCORD_CLIENT_ID=   # application client id — exposed to the browser
DISCORD_CLIENT_ID=        # same id, read by apps/api
DISCORD_CLIENT_SECRET=    # OAuth2 client secret — apps/api only, never client-side
API_PORT=3001             # port for the token-exchange API
```

## 3. Run

```bash
bun install
bun run dev:api        # token exchange on http://localhost:3001
bun run dev:activity   # vite dev server on http://localhost:5173
```

The Vite dev server proxies `/.proxy/*` to the local API, mirroring Discord's production proxy, so the client code is identical in dev and production.

To test inside Discord, expose the dev server with a tunnel (e.g. `cloudflared tunnel --url http://localhost:5173`) and set the tunnel URL as the Activity's URL mapping root.

## 4. Auth Flow in Code

1. `libs/sdk` → `createDiscordSdk(clientId)` builds the singleton SDK for the frame.
2. `authenticateUser(sdk, clientId, "/.proxy/api/token")` runs `ready → authorize → token exchange → authenticate`.
3. `apps/api` `POST /api/token` swaps the authorization code for an access token using the client secret (`authentication.md` has the full sequence diagram).
4. `apps/activity` consumes it through `useDiscordAuth()` and renders the authenticated user.

## Mock Mode (planned)

Outside the Discord iframe there is no RPC bridge, so the page will hang at `ready()` in a plain browser tab. A mock transport in `libs/sdk/client` returning fixture data is planned (see `roadmap.md`).
