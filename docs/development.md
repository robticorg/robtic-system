# Development

## Prerequisites

- [Bun](https://bun.sh) >= 1.1.0
- MongoDB (local instance or connection string)
- Discord bot tokens for the bots you want to run

## Setup

```bash
bun install
cp .env.example .env   # fill in MONGODB_URI and bot tokens
```

Non-production runs resolve the `main` bot token from `TestBot` instead of `MainBotToken` (see `libs/core/src/config/clients.ts`).

## Commands

All commands run from the repository root (asset paths are cwd-relative):

```bash
bun run dev          # watch mode with Bun preload shim
bun run typecheck    # tsc --noEmit over apps/ and libs/
bun run build        # bundle apps/bot to dist/index.js
bun run start        # run the production bundle
```

## Workspaces

The repo uses Bun workspaces (`apps/*`, `libs/*`). Dependencies are currently hoisted to the root `package.json`; workspace manifests declare identity only. Adding a dependency: add it at the root until per-package dependency ownership lands (see `docs/roadmap.md`).

## Adding a Command / Event / Component

Drop a file into the bot's `commands/`, `events/`, or `components/` folder under `apps/bot/src/<bot>/` — `ModuleLoader` picks it up by convention, no registration list to edit. Slash commands re-register on client ready.

## Monitors

`scripts/monitor/` contains PM2-based crash and memory monitors run outside the main process; they import status reporting from `libs/core` by relative path and are not part of the typecheck program.
