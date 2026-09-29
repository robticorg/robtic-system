# Folder Structure

```
apps/
    bot/
        src/                     One bot, one client. Big systems live in features/; everything
                                 else is grouped by kind, then by command scope.
            index.ts             Entrypoint: DB connect + ClientManager bootstrap
            features/            One folder per big system — see the layout below
            commands/            Commands too small to be a feature, in the scope tree:
                                   global/          data shared across all servers
                                   guild/admin/     staff-restricted (moderation/ nested
                                                    inside)
                                   guild/general/   any member
                                   guild/games/     any member, game-related
                                   admin/           super users only, admin-guild only
            components/          *.component.ts outside any feature
            events/              *.event.ts outside any feature
            services/            Background work and schedulers not yet owned by a feature
            utils/               Helpers, plus the shared pipeline: access/, interaction/,
                                 prefix/, help/, lang/, server-log/, staff-activity/
            guards/              Server whitelist enforcement

        A feature folder, using points as the example. Omit any file the feature
        does not need — no events means no points.event.ts.

            features/points/
                points.ts            Manifest: key, description, activation, commands, subcommands
                points.command.ts    Builds the builder from the manifest, dispatches to commands/
                points.message.ts    Prefix form — a bare `!points` prints its subcommand list
                points.event.ts      This feature's gateway listeners, schedulers included
                points.component.ts  FeatureComponentIndex re-exporting components/
                commands/            One file per leaf subcommand
                components/          One file per button, select menu or modal
                functions/           Domain orchestration and event bodies
                utils/               Embeds and feature-local helpers
                lib/                 Re-export barrel over the matching libs/core domain
    minecraft-api/                  Minecraft API — owns MongoDB; bot and Minecraft servers are clients
    minecraft-plugin/            Paper plugin (Java/Maven) — Minecraft client for the shared MongoDB
        src/main/java/org/robtic/minecraft/
            config/              Immutable config.yml snapshot
            persistence/         MongoProvider, collection names, repositories
            service/             Linking, prices, exchange, chat bridge, status, LuckPerms sync
            gui/                 Exchange menus and their controller
            listener/            Connection, chat, menu clicks, NPC interaction
            command/             /link, /robs (aka /bal), /exchange, /robtic

libs/
    core/
        src/
            bot-client.ts        Discord.js client wrapper
            client-manager.ts    Client lifecycle: initialize, start, reload
            module-loader.ts     Dynamic command/event/component loading
            ai/                  Rule-based message/activity classifiers (no external AI provider)
            loader/              Module scan and registration (commands, events, components, manifests)
            features/            Feature manifest registry and the enable/disable gate
            metrics/             The metric bus activity systems publish to
            <domain>/            One folder per domain, discord.js-free: activity, combo,
                                 leaderboard, minecraft, points, profile, rewards, streak, xp, ...
            config/              BOT_DEFINITION, BRANCH_CONFIG, constants (extraction pending)
            handlers/            Error handling
            libs/                Logger, health, permissions (extraction pending)
            utils/               Core utilities (extraction pending)
    database/
        src/
            connection.ts
            models/              Mongoose schemas
            repositories/        Static-class repositories, one per aggregate
    types/                       Shared ambient types (bot.d.ts)
    sdk/                         Robtic API client + DTOs, plus the Discord Embedded App layer
        src/{api-client,dto,validation,errors,authentication,client,types}/
    config/                      Scaffold — future home of configuration
    constants/                   Scaffold — future home of all static values
    utils/                       Scaffold — future home of pure utilities
    logger/                      Scaffold — future logging abstraction
    cache/                       Scaffold — Redis / pub-sub
    events/                      Scaffold — shared event definitions
    shared/                      Scaffold — misc reusable helpers

docs/
    architecture.md, folder-structure.md, coding-style.md, contributing.md,
    deployment.md, development.md, roadmap.md
    database/                    Database docs
    bot/                         Feature docs (combo, economy, streak, voice, ...)

infra/                           All infrastructure definitions. Terraform and Kubernetes
                                 get siblings of docker/.
    docker/
        dockerfiles/             One per service, named for it. Build context is the
                                 repository root for all but minecraft-plugin.
        compose/                 docker-compose.yml (production) and .local.yml (developer)
        scripts/build.sh         Builds any one image, from anywhere in the repo
        configs/                 Reserved — see .gitkeep
        README.md                Contexts, and why .dockerignore is not in here

scripts/
    monitor/                     PM2 crash monitor, memory monitor

images/                          Bot-attached assets (cwd-relative at runtime)

.dockerignore                    Stays at the repository root: Docker reads it from the
                                 build context root, never from beside the Dockerfile.
```

## Conventions

- Folders: lowercase. Files: kebab-case. Functions: camelCase. Types/interfaces/enums: PascalCase. Constants: UPPER_SNAKE_CASE.
- Organized by kind first (`commands/`, `events/`, `components/`, `services/`, `utils/`), then by
  system for the five that were merged in from separate bots.
- `index.ts` barrels only where they genuinely shorten imports (`@core/config`, `@core/libs`, `@database/repositories`, `@database/models`).
