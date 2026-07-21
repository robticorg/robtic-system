# Discord SDK — WebSocket Architecture (Future)

## Purpose

Push live platform data (combo score changes, streak claims, leaderboard movement, ticket activity) to the Activity and dashboard without polling.

## Design

```
apps/bot ──(emits domain events)──▶ libs/events ◀──(subscribes)── apps/api WS gateway ──▶ clients
```

- **Event definitions** live in `libs/events`: name, payload type, channel/room scoping. Both emitter and gateway import the same definition — no stringly-typed events.
- **Transport**: single WS endpoint on `apps/api` (`/ws`), authenticated with the Robtic session before upgrade completes.
- **Rooms**: clients subscribe per scope (`guild:<id>`, `user:<id>`, feature channels like `combo:<guildId>`). The gateway authorizes each subscription against the session.
- **Bridging processes**: while bot and API run as separate processes, events cross via Redis pub/sub (`libs/cache`). Until Redis lands, the API can poll Mongo-backed state on an interval as a stopgap.

## Message Envelope

```ts
interface WsMessage<T> {
    event: string;      // from libs/events
    scope: string;      // room the event belongs to
    seq: number;        // per-scope sequence for resume
    data: T;
}
```

## Reliability

- Heartbeat ping/pong; dead connections reaped by the gateway.
- Clients resume with `(scope, seq)`; gaps larger than the retained buffer trigger a REST re-fetch.
- All payloads are DTOs from `libs/types` — never raw Mongoose documents.
