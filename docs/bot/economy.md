# Economy

Two currencies, with different jobs and different sources.

| | What it is | Scope | How it comes into existence |
|---|---|---|---|
| **Points** | The activity currency | **Per guild** | Earned from chat, combo, voice and streaks |

## Earning Points

Nothing pays out per event. Each source accumulates *progress* on the wallet and converts whole
units at the guild's rate, carrying the remainder (`progress -= earned * rate`) — so a member one
message short of a point keeps that message rather than losing it at the boundary.

| Source | Progress field | Default rate | Trigger |
|---|---|---|---|
| Messages | `messageProgress` | 100 messages → 1 point | one real (non-command) message |
| Combo | `comboProgress` | 100 combo score → 1 point | combo score awarded |
| Voice | `voiceProgress` | 10 active minutes → 1 point | the voice tick, when eligible |
| Streaks | — | configurable table | reaching a rewarded day-count, exact match |

Streaks are the exception: they pay a fixed amount rather than accumulating, because each one
fires exactly once — a streak climbs one day at a time.

Every movement writes a `PointHistory` row with `balanceAfter` — an append-only ledger, readable
with `/points history`. `lifetimePoints` only ever climbs; spending reduces the balance alone, so
"earned all-time" stays meaningful after a member cashes out.


## How this relates to XP

Points and XP are independent. The same message can pay both, and voice pays both on the same tick,
but neither converts into the other and levels have no effect on point rates. XP is a progression
number; Points are a balance you spend.

## Commands

| Command | Access |
|---|---|
| `/points balance [user]` · `rates` · `history` · `convert` | anyone |
| `/points add` · `remove` | admin |

## Configuration

Per guild, via `/points` or the Activity admin panel's **Points** section:

| Setting | Default | Bounds |
|---|---|---|
| `messagesPerPoint` | 100 | 1–100,000 |
| `comboPerPoint` | 100 | 1–100,000 |
| `voiceMinutesPerPoint` | 10 | 1–100,000 |
| `streakRewards` | empty | 15 rows, dedup'd by day-count |
| `pointsPerRc` | 100 | 1–1,000,000 |
| `conversionEnabled` | on | |
| `minConversionPoints` | 100 | 1–1,000,000 |

## Data

| Collection | Purpose |
|---|---|
| `Point` | The wallet: `points`, `lifetimePoints`, `rc`, and the three progress counters |
| `PointHistory` | Append-only ledger, one row per movement, with `balanceAfter` |
| `RcConversion` | One row per conversion, with the rate, fee and bonus that applied |
| `PointSettings` | Per-guild rates, cached 60s |
