# Discord SDK — Activity Architecture (Future)

## Client Structure (`apps/activity/src`)

```
components/     Presentational, SDK-agnostic
hooks/          useParticipants, useAuth, useChannel — thin wrappers over providers
pages/          Route views (e.g. leaderboards, combo live view, profile)
layouts/        Frame chrome, safe-area handling inside the Discord iframe
services/
    api/        Typed REST client for apps/api (DTOs from libs/types)
    discord/    Bridges to libs/sdk (auth, RPC commands, subscriptions)
    websocket/  Live event stream client (definitions from libs/events)
providers/      SdkProvider (init/ready), AuthProvider (session), ThemeProvider
contexts/       React contexts backing the providers
utils/          Formatting and view helpers
types/          Activity-local view types only
```

## Layering

```
pages → hooks → providers → services → libs/sdk / libs/events / libs/types
```

Components never import the Discord SDK directly; everything crosses `services/discord`, which delegates to `libs/sdk`. This keeps pages testable in a browser without Discord and lets the dashboard reuse the same REST/WS services later.

## libs/sdk Structure

```
authentication/   authorize/authenticate/token-refresh flows
client/           SDK construction, ready handshake, mock transport
commands/         Typed wrappers over RPC commands the platform uses
events/           Typed SDK event subscriptions (speaking, participants, layout)
utilities/        Proxy-URL helpers, platform detection
types/            SDK-facing types not owned by Discord's package
```
