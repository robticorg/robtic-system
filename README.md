# Robtic System

Robtic System is a modular Discord automation platform designed for developer communities.
One bot runs every system, with each system kept as a separate module in the codebase.

## Overview

The system manages community operations, staff workflows, moderation, and service access in a
structured and automated way.

## Services

| Service | What it is | Runs as |
|---|---|---|
| **Bot** | The Discord client. One login, one command tree, every module. | `robtic-system` |

## Core Components

* **Admin** – system controller, configuration manager, and advertisement system
* **Moderation** – moderation tools and punishment logging
* **HR** – staff management, recruitment, and promotions
* **ModMail** – private communication between users and staff
* **Community** – XP, activity tracking, and progression roles
* **Economy** – activity Points and RC
* **Dev** – project sharing and review

## Key Features

* Modular architecture — one client, one login, one command tree
* Database-managed server whitelist (`!addserver <serverid>`)
* Modmail system
* Staff management automation
* Activity and role progression system
* Advertisement ordering and management
* Structured moderation logging

## Technology

* Bun (workspaces monorepo), TypeScript
* Discord.js v14
* MongoDB via Mongoose
* Docker Compose, GitHub Actions

## Repository Layout

```
apps/
    bot/                Discord client — every module
    worker/             Queue consumers

libs/                   Shared libraries: core, database, config, constants,
                        logger, sdk, types, utils, cache, events, shared

infra/
    docker/             Every Dockerfile and Compose file

docs/                   All documentation
scripts/                Operational and CI checks
```

See [docs/folder-structure.md](docs/folder-structure.md) for the full tree, and
[docs/architecture.md](docs/architecture.md) for how the pieces fit together.

## Getting Started

```bash
bun install
cp .env.example .env          # fill in the required values
bun run dev                   # the bot, in watch mode
```

The whole stack, in containers:

```bash
bun run docker:local -- up --build
```

See [docs/development.md](docs/development.md).

## Configuration

Two layers, and the split is deliberate:

* **Infrastructure** — tokens, database URI, public URLs — lives in `.env`. See `.env.example` for
  every variable and which service reads it. In production the file lives at
  `/home/robtic/robtic-system/.env` and is edited by hand on the server; CI never writes it.
* **Everything operational** — prefixes, log channels, the server whitelist, feature toggles, XP,
  streak and quest settings — is stored in MongoDB and configured from Discord.

## Deployment

Images are built by GitHub Actions and published to GHCR, then run with Docker Compose on
`core.robtic.org`. Each service is content-addressed, so a push only rebuilds and redeploys what
actually changed. Configuration is not deployed — `.env` is maintained on the server by hand.

* [docs/deployment.md](docs/deployment.md) — the pipeline, per-service
* [infra/docker/README.md](infra/docker/README.md) — Dockerfiles, build contexts, Compose

## Minecraft

Everything Minecraft — the Minecraft API, the Paper plugins and their CI — lives in its own project,
`robtic-minecraft`, next to this one. This repository no longer builds, deploys or depends on it.

## Purpose

Robtic System aims to provide a reliable automation backbone for developer-focused communities and
services.
