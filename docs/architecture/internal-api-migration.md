# Internal API & worker migration — Phase 1 map

Analysis of the repository as of 2026-10-05, before any architectural change. This is the
dependency map and migration plan the refactor follows; each phase lands separately and must keep
every existing behavior.

## 1. What exists today

### Processes (Docker Compose, `infra/docker/compose/docker-compose.yml`)

| Service | What it is | Ports |
|---|---|---|
| `robtic-system` | The Discord Gateway (`apps/bot`): every command, component and event, **plus all business logic**, plus the bank API (`Bun.serve`, :8790) and the music-bot clients | 8790 (bank API) |
| `robtic-minecraft-api` | `apps/minecraft-api` — an internal HTTP API for the Minecraft plugin | 3002 |

No Redis, no queue, no worker. Both services share the default Compose network.

### Monorepo conventions

- Bun workspaces: `apps/*`, `libs/*` (there is no `packages/`). Path aliases in the root
  `tsconfig.json` (`@core`, `@database`, `@constants`, `@logger`, `@sdk`, …).
- Database: Mongoose models + static repositories in `libs/database` (~80 repositories).
- Domain logic: `libs/core` (no discord.js), Discord glue in `apps/bot`.
- Logger: `@logger`. Errors: `@core/handlers`.

### The existing internal API — the precedent to follow

`apps/minecraft-api` already is a Robtic internal API, and its conventions become the template:

- plain `Bun.serve`, no framework; a route table (`router.ts`) that also generates the OpenAPI
  document; controllers → services → repositories;
- shared envelope/errors from `@sdk` (`ok()` / `failure()`, `ApiError`), bearer-token auth,
  rate limiting, idempotency middleware, request context;
- `GET /api/health` without auth for the container probe; one Mongo connection pool per process.

It stays where it is (`apps/minecraft-api`) — moving it is not required by this refactor.

### Commands, components, events (loaded by `libs/core/src/loader`)

14 features · 65 commands · 40 component handlers · 58 event listeners · 4 prefix-only commands.

### External integrations — stay in the Gateway (§4)

| Integration | Where | Used by |
|---|---|---|
| Staff API (host :8788) — `/internal/staff/points`, `/internal/staff/role` | `apps/bot/src/services/staff-api`, `staff-points` | message milestones, `?roles` |
| Discord REST (bot token) | `libs/core/src/music/bot-account.ts`; minecraft-api's `discord-*-service.ts` | `/music create`; role sync, logs |
| Discord webhooks | `apps/minecraft-api/src/services/discord-log-service.ts` | Minecraft logs |
| YouTube (yt-search, yt-dlp binary, GitHub download) | `features/music/engine/youtube.ts` | music bots |
| Discord attachments (download) | `setline`, `partner-form`, `captcha-resolver` | uploads, OCR |
| Tesseract OCR (local) | `services/bank/worker.ts` | bank captcha |
| Bank self-bot + bank API :8790 | `services/bank/*` | transfers |
| mc-heads.net avatars, GitHub raw assets | chat bridge, branch config | embeds |

The AI "classifier" (`libs/core/src/ai`) is local and rule-based — no external call.

### Background processing that already exists (in-process)

| Job | Mechanism | Cadence |
|---|---|---|
| Activity "last seen" | in-memory map → `flushActivity` bulk write | timer |
| Voice sessions | in-memory sessions, 1-min tick, slow persist, crash recovery on start | 1 min / slower |
| Decay | `setInterval` | hourly, once/day per member per kind |
| Streak, combo schedulers | `setInterval` | periodic |
| Support session cleanup | `setInterval` | periodic |
| Minecraft bridge poll + status panel | `setInterval` | seconds |
| Invites join/leave | per-guild serial queue (`createGuildQueue`) | per event |
| Booster tracking | per-guild serial queue | per event |
| Boost thank-you batching | in-memory 30-min debounce | per boost |

None of it survives a restart except what each feature persists itself.

### The hot path — one message

A normal message runs ~14 `messageCreate` listeners. The ones that touch MongoDB are, roughly:
line config + commands-channel guard (reads), message stats (real-message counter, 4 period
buckets, message point progress, staff-point milestone), community XP (support-channel/excluded/
allowed-role reads, XP write, 2× period buckets, activity log ×1–2, level-up path), combo, and
streak. **≈ 15–25 Mongo operations per message**, all inline in the Gateway's event handlers.
Voice adds ≈ 5 writes per active member per minute (XP, period stats, log, points).

## 2. Target layout (following the conventions above)

```
apps/
  bot/                 Main Gateway — Discord only + external integrations (unchanged role)
  minecraft-api/       unchanged
  worker/              NEW — BullMQ consumers, no public port
internal-api/          NEW — one directory per domain API (Bun.serve, minecraft-api conventions)
  <domain>/            src/{routes,controllers,services}, package.json, Dockerfile
libs/
  queue/               NEW — Redis connection, queue names, job types, default retry policy
  internal-client/     NEW — typed Gateway → internal API clients (timeouts, errors, request ids)
```

`libs/queue` and `libs/internal-client` instead of the spec's `packages/…`, because this repo's
shared code lives in `libs/`. Compose gains `redis:7-alpine` and a private network; internal
APIs and the worker publish **no** ports.

## 3. Migration map by domain

| Domain | Today | Sync (API) | Async (queue → worker) | Risk |
|---|---|---|---|---|
| Activity / XP / messages | inline per message | `/level`, `/profile`, `/top` reads | message events → Redis aggregation → periodic flush; level-up → notification job | **High** — levels, roles, rewards |
| Voice | in-memory + 1-min tick | `/voice` reads | per-minute grants → aggregated flush | High |
| Invites | per-guild serial queue | `/invites`, `/info` | join/leave → invite job (detection stays in Gateway: it needs the invite cache) | Medium |
| Economy (points, robs, rewards, referral) | inline | balance/summary/referral | reward claims as idempotent jobs | **High** — money |
| Moderation | inline, punishments in Mongo | case reads/writes | timed unmutes/unjails, audit logs | Medium |
| Members/profile | inline reads | profile snapshot | — | Low |
| Notifications (boost thanks, level-ups, logs) | inline / in-memory batch | — | notification jobs (Discord sends stay in Gateway or a Discord-REST worker) | Low–Medium |
| Roles (`?roles`) | Discord cache + external staff API | — | — | Poor fit: the data is Discord state, not MongoDB |

Not migrated: music bots (they *are* Discord clients), the bank (drives a Discord client), the
Minecraft API (already separate).

## 4. Phases

1. **Analyze** — this document.
2. **Infrastructure** — Redis in Compose, private network, `libs/queue`, `apps/worker` skeleton
   (health, graceful shutdown, concurrency from `WORKER_CONCURRENCY`). No behavior change.
3. **Internal API foundation** — `internal-api/` with the shared server bootstrap (auth via an
   internal token, request ids, health, graceful shutdown) and `libs/internal-client`.
4. **First domain** end to end, Gateway → API → Mongo and Gateway → queue → worker → Mongo.
5–7. Remaining domains one at a time, then delete the replaced Gateway code.

Every phase keeps the existing check suites green and adds tests for its domain.

## 5. Status — Phases 2–4 done (invites)

| Piece | Where |
|---|---|
| Redis (`redis:7-alpine`, AOF, private network, no ports) | `infra/docker/compose/docker-compose.yml` → `robtic-redis` |
| Queue names, job types, retry policy, job ids | `libs/queue` (`@queue`) |
| Internal API bootstrap (auth, request ids, envelope, health, shutdown) | `libs/internal-api` (`@internal-api`) |
| Typed Gateway clients + controlled errors | `libs/internal-client` (`@internal-client`) |
| Invites domain (shared by API and worker) | `libs/core/src/invites` |
| Invites API `:3005` | `internal-api/invites` → `robtic-invites-api` |
| Worker (invites queue) | `apps/worker` → `robtic-worker` |
| Discord outbox consumer (posts what workers queue) | `apps/bot/src/services/discord-outbox` |

The worker and the Invites API run from the **same image** as the Gateway (`robtic-system`), with a
different `command` per Compose service — CI still builds and deploys one image.

### Invite flow now

```
guildMemberAdd → Gateway: detect the used invite (invite cache)
              → invites queue (job id from the event — no duplicates)
              → worker: fake check, reward credit, history (idempotent)
              → discord-outbox queue → Gateway: announce in the invites channel
/invites, /info → Gateway → Invites API → MongoDB → Gateway → Discord
```

- Without `REDIS_URL` (local dev, or before the stack is deployed) the Gateway runs the same
  `@core/invites` code inline — behavior is exactly the pre-refactor one. Without `INVITES_API_URL`
  the commands read in-process. Nothing needs Redis to keep working.
- Ordering: the invites queue has a global concurrency of 1 in Redis, so join/leave order holds
  across any number of worker replicas.
- Retries: 6 attempts, exponential backoff from 1s; invalid jobs fail permanently
  (`UnrecoverableError`) and stay in the failed set.
- Tests: `bun run test:internal` (API, client, queue, worker idempotency/retries, outbox).

### Required configuration

`INTERNAL_API_TOKEN` in `.env` (shared by the Gateway and every internal API — the APIs refuse to
start without it). Compose sets `REDIS_URL` and `INVITES_API_URL` itself.

### Adding the next internal API

1. `internal-api/<domain>/` with `package.json`, `src/routes.ts` (an injectable service, like
   `internal-api/invites`) and `src/index.ts` (`connectDatabase` + `startInternalApi`).
2. Domain logic in `libs/core/src/<domain>` — the API and workers import it; the Gateway never
   duplicates it.
3. A typed client in `libs/internal-client`, a `<DOMAIN>_API_URL`, a Compose service from the same
   image with its own port and a `/health` healthcheck.
4. Copy its `package.json` in both Dockerfiles' deps stage (`bun run test:workspaces` checks this).
5. Async work: a queue in `libs/queue` (name, payload type, job-id helper) and a processor in
   `apps/worker/src/processors`, tested with in-memory stores.
