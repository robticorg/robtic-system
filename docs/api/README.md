# API Documentation

`apps/api` is an architecture-only scaffold; no endpoints exist yet.

Planned shape:

- Versioned REST under `/api/v1`, controllers delegating to `libs/core` services
- WebSocket gateway at `/ws` (see `../sdk/websocket.md`)
- Discord OAuth2 + Activity token exchange (see `../sdk/authentication.md`)
- Route constants in `libs/constants`, DTOs in `libs/types`

Endpoint documentation will be added here as routes are implemented.
