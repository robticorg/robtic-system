# Deployment

Deployment is GitHub Actions (`deploy-*.yml`) driving
`infra/docker/compose/docker-compose.yml` on the self-hosted runner. Every push to `main` builds the
images that changed and restarts the corresponding containers.

**Configuration is not deployed.** `/home/robtic/robtic-system/.env` is edited **by hand on the
server** and is never written by CI — no config-management tool touches it, so nothing will overwrite
your edits. `.env.example` at the repository root lists every variable and which service reads it;
keep the two in step by hand when a variable is added or removed.

After editing `.env`, the containers must be recreated to pick it up — Compose reads `env_file` at
container-create time, not on restart:

```bash
cd /home/robtic/robtic-system
docker compose -f infra/docker/compose/docker-compose.yml -p robtic-system \
  --env-file /home/robtic/robtic-system/.env up -d --force-recreate --remove-orphans
```

Back the file up before editing it; it is the only copy of the production secrets, and it is
deliberately absent from git.

## Pipeline

Each service has its own workflow. All delegate to the shared `robticorg/robtic-actions` Docker
deploy workflow on the self-hosted runner (`robtic-deploy`, `core.robtic.org`):

Dockerfile paths below are relative to `infra/docker/dockerfiles/`.

| Workflow | Trigger | Image | Dockerfile | Compose service |
|---|---|---|---|---|
| `deploy-minecraft-api.yml` | push to `main` | `ghcr.io/robticorg/robtic-minecraft-api` | `minecraft-api.Dockerfile` | `robtic-minecraft-api` |
| `deploy-bot.yml` | the Minecraft API workflow finishing | `ghcr.io/robticorg/robtic-system` | `bot.Dockerfile` | `robtic-system` |

The Minecraft API (`apps/minecraft-api`, `minecraft.api.robtic.org`) is the service the Minecraft
plugin talks to, and the only one permitted to reach MongoDB. It deploys first, because the bot and
every game server are its clients.

Every Docker artefact — Dockerfiles, both Compose files, the build script — lives under
`infra/docker/`; see [`infra/docker/README.md`](../infra/docker/README.md) for the layout and for the
build contexts, which are the repository root rather than the directory the Dockerfile sits in.

Each workflow's `compose-pull-command` and `compose-up-command` name the topology explicitly:

```bash
docker compose -f infra/docker/compose/docker-compose.yml -p robtic-system \
  --env-file /home/robtic/robtic-system/.env up -d <service>
```

The `-f` is not optional any more. These commands used to run without it and resolve a
`docker-compose.yml` in the deploy working directory on the server, which is why that directory must
now contain the repository tree at `infra/docker/compose/docker-compose.yml`.

Every workflow except the bot's pulls/ups **only its own service** (full-command overrides, since
the shared workflow does not append project args to overridden commands); the bot workflow's
commands name no service at all, so its `compose pull` + `up -d` covers the whole stack — by which
point every image exists in GHCR.

### The deploy chain

A client restarts *after* the service it depends on, and the chain is wired to the upstream
*workflow* finishing, whatever it decided:

- The bot is a client of the Minecraft API: `deploy-bot.yml` fires when **Deploy Minecraft API**
  finishes.

- A **skipped** deploy (unchanged) still releases the client. Only a *failed* service run stops it,
  because restarting a client against a half-deployed service is worse than not restarting it.
- All the workflows share one `concurrency` group (`deploy-compose`), named after the server rather
  than the workflow, so they queue behind each other on `docker compose` instead of racing — which
  is what makes running them in parallel safe.
- A chained workflow checks out `github.event.workflow_run.head_sha`, not whatever `main` points
  at now: a push landing mid-deploy would otherwise sign a different tree than the one deploying.
- The decision logic lives once, in the local composite action
  `.github/actions/deploy-decision`, so the caching rule cannot drift between the files.

## Only what changed gets rebuilt

A push touching one service used to rebuild and redeploy everything. Now each service is
**content-addressed**.

1. Each workflow's `changes` job runs `scripts/deploy-signature.sh <service>`, which hashes every
   tracked file that can affect that image — its own source, the libs it actually uses, the
   Dockerfile, the workspace manifests, the lockfile, the shared tsconfig, and the workflows.
2. That signature is looked up in the Actions cache (`deploy-v1-<service>-<signature>`,
   `lookup-only`). **A hit means this exact content was built and deployed before**, so the job is
   skipped. A miss means it is new.
3. Services that miss build and deploy as before.
4. The `seal` job writes the marker into the cache — but only when that workflow's deploy job
   **succeeded**. A failed deploy leaves its signature unclaimed, so the next push retries it
   instead of skipping a service that never shipped.

| Service | Signature covers |
|---|---|
| `bot` | `infra/docker/dockerfiles/bot.Dockerfile` · `apps/bot` · `libs` · `images` |
| `minecraft-api` | `infra/docker/dockerfiles/minecraft-api.Dockerfile` · `apps/minecraft-api` · `libs` |

Each Dockerfile is named explicitly. They used to be covered incidentally, by sitting
inside the app directory already being hashed; once they moved to `infra/docker/` that stopped being
true, and an unlisted Dockerfile is the worst thing to miss here — editing it would leave the
signature unchanged, so the deploy would be skipped as *already deployed* and the edit would never
ship.

Plus, for all of them: `package.json` · `bun.lock` · `tsconfig.json` · `.dockerignore` ·
`apps/*/package.json` · `libs/*/package.json` · `.github/workflows/deploy-*.yml` ·
`scripts/deploy-signature.sh` · `infra/docker/compose/docker-compose.yml`.

The production Compose file is in that list as of the `infra/docker` move, and was not before. That
was a real gap: editing a port mapping or a healthcheck changed what runs on the server while every
signature stayed identical, so the deploy that would have applied it was skipped as *unchanged*. The
local stack is deliberately absent — it never runs on the server.

Each image copies only the app it runs rather than all of `apps`, so a change confined to one app
cannot produce a different image for another and force a pointless redeploy of it.

Properties worth knowing:

- **Content, not commits.** A revert lands back on a signature that is already cached, so it
  redeploys nothing but the reverted service. Rebases and force-pushes are equally harmless.
- **Fails toward deploying.** No cache, a cleared cache, or a 7-day eviction all read as "changed",
  which costs one rebuild. There is no path where a real change reads as unchanged.
- **Skipped is not failed.** Downstream jobs check `result != 'failure'` rather than relying on
  plain `needs`, which would treat a skipped upstream as a reason to skip everything after it.
- **Force a deploy** with the **Run workflow** button on whichever workflow you want, ticking
  `force` to ignore the cache for that run.
- Run `bash scripts/deploy-signature.sh bot` locally to see the same hash the workflow computes.

## Images

- **robtic-system** — Bun runtime, runs the bot from source with the root tsconfig (path aliases resolved at runtime). Needs `images/` and repo-root `WORKDIR`. Copies `apps/bot` only — it imports nothing from the other apps.

`.dockerignore` must keep `**/node_modules` — bun installs workspace deps into per-app `node_modules`, and copying host installs into the image breaks the Linux-installed packages.

## Compose Topology (server)

```
robtic-system          (no ports — outbound Discord gateway only)
robtic-minecraft-api   0.0.0.0:3002   -> 3002
```

`robtic-minecraft-api` is the one service published on all interfaces: Minecraft servers reach it
from outside the host, which loopback would refuse. The API key is what protects it.

The `127.0.0.1:` prefix is deliberate and should not be removed: a connection refused from another
machine is that binding working correctly.

→ **[deployment-nginx.md](./deployment-nginx.md)** — kept for when the stack goes back behind
domains; describes the Nginx topology, including `minecraft.api.robtic.org`.

## Required Configuration

**GitHub secret**: `DISCORD_WEBHOOK_DEPLOY` (already configured) — deploy notifications for each job.

## Monitors

`scripts/monitor/` (PM2 crash + memory monitors) run on the host, outside the container lifecycle.
