# Discord SDK — Getting Started (Future)

Implementation has not started; this documents the intended setup for when `apps/activity` goes live.

## Prerequisites

- A Discord application with **Activities** enabled in the developer portal
- URL mapping configured (Discord proxies all Activity traffic through `discord.com/proxy`)
- `VITE_DISCORD_CLIENT_ID` in the activity environment

## Planned Setup

```bash
cd apps/activity
bun install
bun run dev        # vite dev server, tunneled for the Discord client
```

## Initialization Sketch

```ts
import { DiscordSDK } from "@discord/embedded-app-sdk";

const sdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);
await sdk.ready();
```

Initialization, retries, and mock-mode (running outside Discord during development) will live in `libs/sdk/client` so the app code never constructs the SDK directly.

## Mock Mode

Outside the Discord iframe there is no RPC bridge. `libs/sdk/client` will expose a mock transport returning fixture data so the Activity is developable in a plain browser tab.
