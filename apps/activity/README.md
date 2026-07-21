# @robtic/activity

Discord Embedded Activity for the Robtic Platform.

Status: **architecture only** — no implementation yet.

## Planned Stack

- React
- TypeScript
- Vite
- Discord Embedded App SDK (`@discord/embedded-app-sdk`)

## Structure

```
src/
    components/          Reusable UI components
    hooks/               Custom React hooks
    pages/               Route-level views
    layouts/             Shared page layouts
    services/
        api/             REST client for apps/api
        discord/         Discord Embedded App SDK wrappers (via libs/sdk)
        websocket/       Realtime client (events from libs/events)
    providers/           App-level providers (SDK, auth, theme)
    contexts/            React contexts
    utils/               View-level helpers
    types/               Activity-local types (shared ones live in libs/types)
```

See `docs/sdk/` for the authentication flow, SDK initialization, and backend communication architecture.
