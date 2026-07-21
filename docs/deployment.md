# Deployment

## Pipeline

Pushes to `main` trigger `.github/workflows/deploy.yml`, which delegates to the shared `robticorg/robtic-actions` Docker deploy workflow:

1. Build the Docker image (`Dockerfile`) and push to `ghcr.io/robticorg/robtic-system:latest`.
2. A self-hosted runner (`robtic-deploy`) on `core.robtic.org` pulls and restarts via `docker-compose.yml` with env file `/home/robtic/robtic-system/.env`.

## Docker Image

Two stages:

- **deps** — copies the root manifest, lockfile, and every workspace `package.json`, then `bun install --frozen-lockfile`. Adding or removing a workspace requires updating the `COPY` list in the Dockerfile.
- **runtime** — copies `apps/`, `libs/`, `images/`, and the root `tsconfig.json` (required at runtime: Bun resolves the `@core/*`-style path aliases from it). Entrypoint:

```
bun --preload ./apps/bot/src/preload.ts apps/bot/src/index.ts
```

`WORKDIR /app` is the repo root inside the container — asset loading (`images/`) depends on it.

## Environment

Provided entirely through the server-side `.env` (never committed): `MONGODB_URI`, per-bot tokens (`MainBotToken`, `ModerationBotToken`, `HRBotToken`, `ModeMailBotToken`, `CommunityBotToken`, `DevBotToken`, `TestBot`), and AI/webhook keys. See `.env.example`.

## Monitors

`scripts/monitor/` (PM2 crash + memory monitors) run on the host, outside the container lifecycle.
