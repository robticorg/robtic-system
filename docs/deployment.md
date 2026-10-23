# Deployment

Production is the Portainer stack **`robtic-bots`**, defined by
`infra/docker/compose/portainer-robtic-bots.yml` and shared with `robtic-shop`, `robtic-staff` and
`robtic-minecraft`. The full procedure covers networks, Nginx Proxy Manager upstreams, variables,
cutover and rollback. It is in [`deployment-portainer.md`](deployment-portainer.md).

**Configuration is not deployed.** Values live only in the stack's environment variables in
Portainer and are never written by CI. `infra/docker/portainer-robtic-bots.env.example` lists every
name and the application variable it becomes. Keep it in step with the manifest by hand when a
variable is added or removed. After changing a variable, use **Update the stack**. Compose reads the
environment when it creates a container, not when it restarts one.

## Pipeline

`deploy-bot.yml`, on every push to `main`, all on GitHub-hosted runners:

| Job | Does |
|---|---|
| `changes` | Content signature of the image (below). Unchanged → everything after it is skipped. |
| `image` | Builds `infra/docker/dockerfiles/bot.Dockerfile`, pushes `ghcr.io/robticorg/robtic-system:production` and `:sha-<commit>`. |
| `redeploy` | `POST`s the `robtic-bots` stack webhook (`ROBTIC_BOTS_PORTAINER_WEBHOOK_URL`). Portainer re-pulls and recreates the containers whose image changed. |
| `notify` | Deploy result to `DISCORD_WEBHOOK_DEPLOY`, when set. |
| `seal` | Records the signature, once the redeploy succeeded. |

There is no `register` job any more: it ran `register-commands.ts` inside the running container on
the self-hosted runner. The Gateway that wins leadership publishes the commands every time it
starts, and a new image always recreates it. See *Slash commands* in
[`deployment-portainer.md`](deployment-portainer.md).

The Minecraft API and plugins moved to the separate `robtic-minecraft` project, which builds and
pushes its own image. It runs in the same stack.

Every Docker artefact — Dockerfiles, Compose files, the build script — lives under
`infra/docker/`; see [`infra/docker/README.md`](../infra/docker/README.md) for the layout and for the
build contexts, which are the repository root rather than the directory the Dockerfile sits in.

- The workflow's `concurrency` group (`deploy-compose`) queues runs instead of cancelling them, so
  a push landing mid-deploy waits its turn.
- The decision logic lives once, in the local composite action
  `.github/actions/deploy-decision`.

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

Each Dockerfile is named explicitly. They used to be covered incidentally, by sitting
inside the app directory already being hashed; once they moved to `infra/docker/` that stopped being
true, and an unlisted Dockerfile is the worst thing to miss here — editing it would leave the
signature unchanged, so the deploy would be skipped as *already deployed* and the edit would never
ship.

Plus, for all of them: `package.json` · `bun.lock` · `tsconfig.json` · `.dockerignore` ·
`apps/*/package.json` · `libs/*/package.json` · `.github/workflows/deploy-*.yml` ·
`scripts/deploy-signature.sh` · `infra/docker/compose/portainer-robtic-bots.yml`.

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

## Stack topology (`robtic-bots`)

No container publishes a host port.

```
robtic-system           internal, backend        bank API :8790 (internal only)
robtic-system-standby   internal, backend
robtic-system-worker-1  internal, backend
robtic-system-worker-2  internal, backend
robtic-invites-api      internal, backend        :3005 (internal only)
robtic-minecraft-api    internal, backend, proxy :3002 → minecraft.api.robtic.org (NPM)
robtic-shop             default                  (JSON volume robtic-bots-shop-database)
robtic-staff            internal, backend        points API :8788 (internal only)
```

## Required Configuration

**GitHub secrets**: `ROBTIC_BOTS_PORTAINER_WEBHOOK_URL` (the stack webhook) and
`DISCORD_WEBHOOK_DEPLOY` (optional, deploy notifications). `GITHUB_TOKEN` pushes to GHCR.

## Monitors

`scripts/monitor/` (PM2 crash + memory monitors) run on the host, outside the container lifecycle.
