# Discord SDK — Backend Communication (Future)

## Channels

| Channel | Use | Contract source |
|---|---|---|
| REST (`apps/api`) | Request/response: profiles, leaderboards, config, history | Route constants in `libs/constants`, DTOs in `libs/types` |
| WebSocket (`apps/api`) | Live: combo updates, streak events, presence-flavored data | Event definitions in `libs/events` |
| Discord RPC (in-iframe) | Discord-context only: participants, voice, layout | `libs/sdk` |

## REST Architecture

- All Activity/dashboard traffic goes through Discord's proxy — API routes must be mapped in the developer portal URL mappings and be same-origin from the iframe's perspective.
- Versioned base path (`/api/v1`).
- Auth via the Robtic session issued during token exchange (`authentication.md`); no Discord tokens on the wire after exchange.
- Controllers in `apps/api` stay thin: validate → call `libs/core` service → map to DTO.

## Data Ownership

- `libs/core` services are the single implementation of business rules — the bot and the API call the same functions.
- The Activity holds no authority: every mutation is validated server-side against the session's user/guild.

## Failure Model

- REST: conventional status codes + typed error body (`libs/types`).
- WS: heartbeat + resume with a cursor so missed live events replay from Mongo-backed history where a feature needs continuity.
