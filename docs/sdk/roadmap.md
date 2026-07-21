# Discord SDK — Roadmap

## Milestone 1 — Foundations
- Implement `libs/sdk/client` (init, ready, mock transport) and `libs/sdk/authentication`.
- `apps/api` auth: OAuth code exchange + Robtic session issuing.
- Vite + React bootstrap in `apps/activity` with URL-mapping-safe config.

## Milestone 2 — Read-Only Activity
- REST endpoints for profile, combo, streak, leaderboards (reusing `libs/core`).
- Activity pages rendering read-only data inside Discord.
- Typed REST client in `apps/activity/src/services/api`.

## Milestone 3 — Live Data
- `libs/events` definitions for combo/streak/leaderboard events.
- WS gateway in `apps/api`; Redis pub/sub via `libs/cache` to bridge bot → API.
- Live combo view in the Activity.

## Milestone 4 — Interactivity
- Authenticated mutations (claim streak reward, profile settings) with server-side validation.
- Participant-aware features using SDK events (who's in the voice channel/activity).

## Milestone 5 — Platform Reuse
- Dashboard consumes the same REST/WS services.
- Shared component/DTO hardening; rate limiting; observability on the gateway.
