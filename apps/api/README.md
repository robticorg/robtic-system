# @robtic/api

REST and WebSocket backend for the Robtic Platform (dashboard, activity, future clients).

Status: **architecture only** — no business logic migrated yet.

## Planned Structure

```
src/
    routes/              REST route definitions (constants in libs/constants)
    controllers/         Request handling, no business logic
    middleware/          Auth, rate limiting, validation
    websocket/           Gateway using libs/events definitions
    auth/                Discord OAuth2 + Activity token exchange
```

Business logic stays in `libs/core`; this app only exposes it over HTTP/WS.
See `docs/sdk/communication.md` and `docs/sdk/websocket.md`.
