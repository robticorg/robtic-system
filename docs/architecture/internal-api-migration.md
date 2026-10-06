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

## 6. Status — activity: message counter

The per-message MongoDB writes (real-message total, the four `messages` period buckets, message
progress → Points) and the staff-point call every 100 messages now go through Redis and the worker.

```
messageCreate → Gateway: HINCRBY act:msg:pending  `day|guild|member` (one Redis round trip)
activity queue, every ACTIVITY_FLUSH_MS (job scheduler, global concurrency 1)
              → worker: take the pending hashes atomically as batch <id> (Lua RENAME)
              → per member: realMessageCount + decay clock, period buckets, points — each write
                guarded by the batch id, so a retried flush applies nothing twice
              → each 100-message milestone crossed → staff-points queue (job id per milestone)
              → drop the batch
staff-points queue (EXTERNAL_API_CONCURRENCY) → external staff API (type "msg", idempotency key)
```

- A flush that dies mid-way leaves its batch (and `act:msg:inflight`) in Redis; the next run resumes
  that batch before taking new messages. Messages that arrive during a flush start the next batch.
- Days stay separate in the buffer, so a batch spanning midnight or a week/month boundary still
  lands in the right period buckets.
- Staff API: 404 (not staff) is final; 5xx/timeouts retry with backoff; other 4xx fail permanently.
- Without `REDIS_URL`, or if Redis errors on a message, the Gateway writes MongoDB inline exactly as
  before — nothing goes uncounted.
- Message XP and combo moved next (§7, §8). Streak stays inline (§8).
- Tests: `bun run test:activity` (grouping, milestones, crash-at-every-write + retry, flush resume,
  staff-API error mapping). The Lua scripts in `libs/queue/src/message-buffer.ts` need a real Redis
  and are not covered by the in-memory checks.

## 7. Status — activity: message XP

```
messageCreate → Gateway: support channel? excluded channel? allowed role? meaningful?
              → SET xp:cd:<guild>:<member> NX PX 60000 (the cooldown, atomic across processes)
              → roll the XP, xp queue (job id per message)
              → worker: XP + levels-before snapshot in one guarded write, period stats,
                xp_gain / level_up logs (unique keys), levels only raised
              → discord-outbox: level-up (level roles, then announcement) and the XP log embed
```

- Exactly once: the member's row keeps its last 20 XP job keys and each period bucket its last 10
  batch ids, so a retry is refused even if newer gains landed first. The snapshot of the levels
  before the gain is written with it, so a retried job still knows it was a level-up; the
  announcement's job id is per level, so it's never posted twice.
- The old cooldown read `lastXPGrant` and then wrote it, so two quick messages could both earn XP.
  The Redis `SET NX` lets exactly one through.
- Without `REDIS_URL`, or if claiming the cooldown or queueing fails, `grantXP` runs inline as before
  (a claimed cooldown is released first when nothing was queued).
- Voice XP is unchanged (inline, one-minute tick).
- Tests: `bun run test:xp`.

## 8. Status — activity: combo

```
messageCreate → Gateway: detect the partner (channel buffer + partner from Redis), measure the message
              → combo queue (job id per message, global concurrency 1 — messages apply in order)
              → worker (@core/combo): stale pair? archive once + restart; score, heat, duration;
                combo Points (addProgressOnce); live records; partner → Redis
```

- The combo domain moved from `apps/bot/src/features/combo/functions` to `libs/core/src/combo`
  (heat, staleness, finalize, records, history, favorite partner, score range, apply). The bot's
  old module indexes re-export it; the scheduler sweep (expiry, heat decay, snapshots, champion
  role) stays in the Gateway and uses the same code.
- Two processes now touch combos, so the shared writes became conditional:
  - ending a pair only succeeds while it is active — exactly one of the worker and the scheduler
    archives a conversation;
  - records are raised by MongoDB (`$lt` filter), never saved from a cached copy, so a stale cache
    can't overwrite a higher record; the cache only skips hopeless writes and expires after 30s;
  - a pair remembers its last 20 message ids; combo Points go through `addProgressOnce` (recent
    keys + recorded conversions + ledger idempotency key).
- Score-range changes reach the worker within its 60s cache TTL.
- Without `REDIS_URL`, or if queueing fails, the same `applyComboMessage` runs in the Gateway.
- Streak stays inline on purpose: it writes at most once per member per day, and nearly all of its
  work is Discord (reply with auto-delete, DM, role, reward claim button).
- Tests: `bun run test:combo`.

## 9. Failover

| Failure | What happens |
|---|---|
| A worker crashes | Docker restarts it; the other replica (`deploy.replicas: 2`) keeps consuming. Jobs the dead one held are picked up by the other once their 30s lock expires (`maxStalledCount: 3`) — every processor is safe to re-run. |
| The primary Gateway crashes | Docker restarts it; the restarted container has the same hostname, so it reclaims its own lock at once. |
| The primary Gateway dies for good, hangs, or loses Redis | Its lock (`gateway:leader`, 15s, renewed every 5s) expires and `robtic-system-standby` logs in. |
| The leader can't reach Discord for 3 minutes | It logs out and exits; Docker restarts it and the other Gateway can take over. |
| The primary comes back while the standby leads | It marks `gateway:primary-waiting`; the standby logs out, frees the lock and restarts as the standby. |
| Deploy / `docker compose stop` | The leader logs out *then* frees the lock, so the other takes over in ~2s and the two are never logged in together. |
| Redis down | The leader keeps leading; a primary that can't reach Redis at boot starts after 15s (as before failover). A standby never logs in without the lock. |

- Only one Gateway may be logged in: two sessions on one token both receive every event, so every
  command and reward would run twice. Everything that talks to Discord (main bot, music bots, bank
  client, outbox, schedulers) starts only after `waitForGatewayLeadership()`.
- Known window: if the leader is cut off from Redis but **not** from Discord for more than 15s, the
  standby takes over while the old leader is still logged in; the old one steps down as soon as it
  reaches Redis again. Both run on the same host and network, so this needs Redis to be reachable
  by one container and not the other. Stepping down on every Redis blip would instead take the bot
  offline whenever Redis restarts.
- The standby publishes no ports: while it leads, the bank API (:8790) is unreachable; it returns
  with the primary.
- Healthchecks (`/tmp/gateway-health`, `/tmp/worker-health`) show in `docker ps`. Plain Compose
  doesn't restart an *unhealthy* container by itself — the in-process watchdog (Discord) and the
  restart policy (crashes) do that.
- One VPS is still one point of failure: if the host goes down, every container goes with it.
- Tests: `bun run test:failover`.

### Split-brain protection (second line, if two Gateways are ever logged in anyway)

1. **Event claims.** Before any listener runs, the Gateway claims the event in Redis
   (`gateway:event:<id>`, 2 min) for messages, interactions, reactions and member joins. The first
   Gateway to claim it handles it; the other skips it — so even then nothing is handled twice.
2. **Action.** A failed claim proves two sessions. The Gateway that doesn't hold the leader lock
   logs out at once; the lock holder keeps running, logs `SPLIT BRAIN` and DMs the bot owner
   (at most every 10 minutes).
3. **Worker watch.** Every job carries `origin` (the Gateway that queued it). Workers flag jobs
   from two Gateways interleaving (A, B, A … three times within a minute — a handover is A then B)
   into `gateway:conflict`; the leader checks it every 5s and acts as in 2.

Redis errors never block events (the claim fails open). Both server lists (whitelist, super
users) are loaded after leadership, so a standby that waited for days doesn't take over with a
stale whitelist — the guild guard would otherwise leave servers added in the meantime.
Tests: `bun run test:split-brain`.

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
