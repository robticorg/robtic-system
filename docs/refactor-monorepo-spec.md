# Robtic System - Monorepo Architecture Refactor

## Objective

Refactor the existing project into a scalable, enterprise-grade monorepo without changing any existing functionality.

This is **NOT** a rewrite.
This is **NOT** a feature update.

The goal is to improve architecture, maintainability, scalability, and prepare the project for future applications.

Everything must continue working exactly as before.

---

# Git Rules

Before making any changes:

1. Fetch the latest changes.
2. Create a new branch.
3. Checkout the new branch.

Example:

refactor/monorepo-architecture

Never modify `main` or any existing branch.

All work must happen on the new branch.

---

# Preserve Existing Behavior

Do NOT:

- Remove features
- Change business logic
- Change commands
- Change permissions
- Change responses
- Change database behavior

Only refactor the architecture.

---

# Future Vision

This repository will become the backend foundation of the Robtic Platform.

It must support:

- Discord Bot
- Discord Activity (Discord SDK)
- Web Dashboard
- REST API
- WebSocket
- Future Desktop Application
- Future Mobile Application
- Future CLI

The architecture must be designed for long-term scalability.

---

# Workspace

Use Bun Workspaces.

Never create a `packages` directory.

Use:

```
apps/
libs/
docs/
scripts/
```

---

# Target Structure

```
apps/
    bot/
    activity/
    dashboard/
    api/

libs/
    core/
    database/
    sdk/
    config/
    constants/
    types/
    utils/
    logger/
    cache/
    events/
    shared/

docs/

scripts/

.github/
```

---

# Applications

## apps/bot

Move the existing Discord bot here.

Everything must continue working exactly as before.

---

## apps/activity

Prepare a Discord Embedded Activity.

Use:

- React
- TypeScript
- Vite
- Discord Embedded App SDK

Only create the architecture.

Do NOT implement features.

Create:

```
src/
    components/
    hooks/
    pages/
    layouts/
    services/
        api/
        discord/
        websocket/
    providers/
    contexts/
    utils/
    types/
```

---

## apps/dashboard

Prepare an empty dashboard structure.

No implementation.

---

## apps/api

Prepare an API application.

No migration of business logic yet.

Only prepare the architecture.

---

# Shared Libraries

Everything reusable belongs inside `libs`.

Never duplicate code.

---

## libs/core

Contains all business logic.

Examples:

Profile

Economy

XP

Combo

Streak

Quest

Inventory

Clan

Leaderboard

Moderation services

The bot should call these services.

Future applications will also reuse them.

---

## libs/database

Database layer only.

Repositories

Models

Schemas

Database connections

No business logic.

---

## libs/sdk

Prepare for Discord SDK integration.

Create:

```
authentication/
client/
commands/
events/
utilities/
types/
```

No implementation.

Only structure.

---

## libs/config

Configuration only.

Examples:

Discord

Database

Redis

Environment

Feature Flags

Logging

Bot

SDK

---

## libs/constants

Every static value belongs here.

Nothing static should exist anywhere else.

Examples:

Messages

Colors

Permissions

Routes

Role IDs

Channel IDs

Emoji IDs

URLs

Limits

Cooldowns

Timeouts

Intervals

Regex

Environment Keys

Collections

Status Text

Button Labels

Embed Titles

Embed Descriptions

Default Values

API Endpoints

Anything static.

---

## libs/types

Shared interfaces.

Shared types.

Enums.

DTOs.

---

## libs/utils

Pure utility functions.

No business logic.

---

## libs/logger

Logging abstraction.

---

## libs/cache

Redis.

Caching.

Future Pub/Sub.

---

## libs/events

Shared event definitions.

Future websocket events.

---

## libs/shared

Shared reusable helpers that don't belong elsewhere.

---

# One Function Per File

Strict rule.

A file may contain ONE function maximum.

Example

Bad

```
user.ts

login()

logout()

refresh()
```

Good

```
login.ts

logout.ts

refresh.ts
```

Every function lives in its own file.

---

# No Duplicate Logic

Search the project for duplicated implementations.

Extract them.

Create reusable functions.

Replace every duplicate.

There must never be two implementations of identical logic.

---

# No Hardcoded Values

Absolutely no hardcoded values.

Move every static value into `libs/constants`.

Everything.

Even:

Strings

Numbers

URLs

Colors

Messages

Titles

Descriptions

Regex

Arrays

IDs

Names

Intervals

Limits

Defaults

Permissions

Routes

Everything.

Constants must have clear descriptive names.

---

# Configuration

Configuration belongs only inside:

```
libs/config
```

Applications should never hardcode configuration.

---

# Types

Move every reusable type into:

```
libs/types
```

Organize by feature.

---

# Database

Do not change the implementation.

Only improve the architecture.

---

# Imports

Remove:

Unused imports

Duplicate imports

Circular imports where possible

Prefer path aliases.

---

# Naming

Maintain consistent naming.

Folders

lowercase

Files

kebab-case

Functions

camelCase

Types

PascalCase

Interfaces

PascalCase

Enums

PascalCase

Constants

UPPER_SNAKE_CASE

---

# Folder Organization

Prefer feature-based organization.

Avoid dumping unrelated files together.

---

# Barrel Files

Use `index.ts` only where it genuinely improves imports.

Avoid unnecessary barrel exports.

---

# Dead Code

Remove:

Unused files

Unused functions

Unused types

Unused constants

Unused utilities

Unused imports

Duplicate code

---

# Comments

No comments.

The ONLY allowed comments are:

- Interface documentation
- Type documentation
- Constant documentation

Everything else must be self-documenting.

No TODOs.

No commented code.

No explanation comments.

---

# Documentation

Move every documentation file into:

```
docs/
```

Nothing documentation-related should remain elsewhere.

---

# Create Documentation

Create:

```
docs/

architecture.md

folder-structure.md

coding-style.md

contributing.md

deployment.md

development.md

roadmap.md

sdk/

    overview.md
    getting-started.md
    authentication.md
    activity-architecture.md
    communication.md
    websocket.md
    roadmap.md

api/

database/

bot/
```

Document the future architecture.

Do NOT implement future features.

---

# Discord SDK Preparation

Prepare the repository for Discord Activities.

Do NOT build the Activity.

Only prepare:

Architecture

Folder structure

Shared SDK layer

Documentation

Explain:

- Authentication flow
- SDK initialization
- Backend communication
- REST architecture
- WebSocket architecture
- Shared services
- Future expansion

---

# Code Quality

The project should feel enterprise-grade.

Prioritize:

- Scalability
- Maintainability
- Reusability
- Readability
- Testability
- Separation of concerns
- Clean architecture
- Future expansion

---

# Validation

Before finishing:

- Ensure the project builds successfully.
- Ensure no feature behavior changed.
- Ensure no duplicate logic remains.
- Ensure no hardcoded values remain.
- Ensure every function is isolated into its own file.
- Ensure documentation is organized.
- Ensure imports are clean.
- Ensure no dead code exists.

---

# Final Report

After the refactor, provide a report containing:

1. New folder tree.
2. Files moved.
3. Libraries created.
4. Duplicate logic extracted.
5. Constants extracted.
6. Configuration extracted.
7. Documentation created.
8. Remaining technical debt.
9. Recommendations for the next refactor phase.

The repository must be left in a fully working, production-ready state.