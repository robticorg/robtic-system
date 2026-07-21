# Discord SDK — Overview

The Robtic Platform will ship a Discord Embedded Activity: a web app (React + Vite) running inside Discord's iframe, talking to the Robtic backend.

## Pieces

| Piece | Location | Role |
|---|---|---|
| Activity client | `apps/activity` | React app booted inside Discord's iframe |
| SDK layer | `libs/sdk` | Wraps `@discord/embedded-app-sdk`: init, auth, RPC commands, event subscriptions |
| Backend | `apps/api` | Token exchange, REST resources, WebSocket gateway |
| Business logic | `libs/core` | Same services the bot uses — no duplication |
| Contracts | `libs/types`, `libs/events` | DTOs and event definitions shared by client and server |

## Lifecycle

1. Discord loads the Activity URL inside an iframe with a `frame_id`.
2. The SDK handshakes with the Discord client (`ready`).
3. `authorize` → OAuth code → sent to `apps/api` → `authenticate` with the returned access token (see `authentication.md`).
4. The client opens a WebSocket for live data and uses REST for request/response (see `communication.md`).

## Principles

- The Activity never talks to the database — only `apps/api`.
- All Discord-specific glue lives in `libs/sdk`, so pages/components stay SDK-agnostic.
- URL mappings (Discord proxy) and CSP constraints are handled at the `apps/activity` build level.
