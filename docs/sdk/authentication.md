# Discord SDK — Authentication Flow (Future)

## Flow

```
Activity (iframe)                 apps/api                        Discord
      |                               |                               |
      | 1. sdk.commands.authorize()   |                               |
      |------------------------------------------------------------->|
      |            <- OAuth2 authorization code                       |
      | 2. POST /auth/token {code}    |                               |
      |------------------------------>| 3. exchange code + secret     |
      |                               |------------------------------>|
      |                               |     <- access_token           |
      | <- {access_token, session}    |                               |
      | 4. sdk.commands.authenticate({access_token})                  |
      |------------------------------------------------------------->|
      | 5. authenticated: user, guild, channel context                |
```

1. `authorize` runs inside Discord with scopes `identify`, `guilds` (extend as needed).
2. The Activity never sees the client secret — the code is exchanged server-side by `apps/api`.
3. `apps/api` issues its own session (short-lived JWT) alongside the Discord access token; REST/WS calls carry the Robtic session, not the Discord token.
4. `authenticate` unlocks SDK commands (voice state, participants, etc.).

## Placement

- Client-side steps: `libs/sdk/authentication`
- Server-side exchange + session issuing: `apps/api/src/auth`
- Session/user DTOs: `libs/types`

## Rules

- Client secret only in `apps/api` env.
- Robtic sessions expire and refresh via the API; the Activity re-runs `authorize` silently when Discord's token lapses.
- Guild/user identity from the SDK is advisory only — the API revalidates against Discord on exchange.
