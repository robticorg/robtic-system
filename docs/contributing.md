# Contributing

## Branches

- Never commit to `main` directly.
- Branch naming: `feat/<topic>`, `fix/<topic>`, `refactor/<topic>`, `chore/<topic>`.
- Fetch before branching; open a PR into `main` when done.

## Commits

Conventional-style prefixes are used in history: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `new:`.

## Pull Requests

- CI (`.github/workflows/ci.yml`) must pass: install + typecheck via the shared `robtic-actions` Bun workflow.
- Keep behavior-changing and refactor-only changes in separate PRs.
- A PR that touches `libs/` must not introduce imports from `apps/`.

## Checklist Before Pushing

1. `bun run typecheck` is clean.
2. `bun run build` succeeds.
3. New static values live in config/constants, not inline.
4. No duplicate logic introduced; extracted helpers live in the right lib.
5. Docs updated when architecture or behavior visible to other developers changes.
