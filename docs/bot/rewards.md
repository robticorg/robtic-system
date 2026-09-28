# Activity & Reward System (Credits)

`libs/core/src/rewards/` — **domain only, still no claim surface.** No commands, no
`features/rewards/` folder yet. The only bot code is two state-tracking event files
(`apps/bot/src/events/rewards/` for Booster, `apps/bot/src/features/invites/` for Invite) that keep that state current — they never pay
anything. Message and voice rewards are wired all the way from existing activity data down to
`claimReward()`, but nothing in the bot calls them yet — that is the next step, once a claim
surface (a command, a scheduled auto-claim, or both) is decided.

A separate currency from the two in [economy.md](./economy.md). Points and RC already have their
own rates, conversions and surfaces — Credits is a distinct reward economy meant for large,
threshold-based payouts (daily message/voice thresholds today; drops, events and Minecraft rewards
later), each claim scaled by a staff multiplier and a set of additive progression bonuses. They
never convert into one another.

## Why not extend Point

`Point` has no `lifetimeSpent`/`lifetimeWithdrawn` tracking and no per-claim bonus formula — adding
both would have changed the shape and meaning of an already-live collection. `RewardWallet` and
`RewardTransaction` mirror `Point`/`PointHistory` structurally (same `move`-with-idempotency-key
pattern, same append-only ledger) but are new collections, so nothing about the existing economy
changes.

## The formula

```
Final Reward = Base Reward × Staff Multiplier × (1 + Total Additive Bonuses)
```

Staff is the one multiplicative term; every other bonus is additive and individually capped before
being summed. All math happens in basis points (integers, `BP_SCALE` = 10_000 per 100%) with a
single rounding step at the very end, so a calculation is deterministic and never drifts the way
repeated floating-point percent math would.

| Source | Kind | Config |
|---|---|---|
| Level | additive, +50% max — **dynamic**, no hardcoded reference level (see below) | `REWARD_LEVEL_BONUS` |
| Staff | multiplicative, ×1.4–×1.6 by StaffTier score | `REWARD_STAFF_BONUS` |
| Streak | additive, +0.1%/day, +10% max at 100 days | `REWARD_STREAK_BONUS` |
| Booster | additive, +15% max, reached faster with more concurrent boosts | `REWARD_BOOSTER_BONUS` |
| Server tag | additive, flat +10% | `REWARD_SERVER_TAG_BONUS` |
| Invite | additive, +1%/active invite, 10 slots max | `REWARD_INVITE_BONUS` |
| Referral | additive, +2%/qualified referral, +15% max | `REWARD_REFERRAL_BONUS` |

All in `libs/constants/src/rewards.ts` — no magic numbers in the calculator or anywhere else.

### What is actually wired today

| Source | Status |
|---|---|
| Level | **Live, dynamic** — see "Dynamic level bonus" below |
| Streak | **Live** — reads `Streak.currentStreak` via `StreakRepository.find`, evaluated fresh every call |
| Server tag | **Live, dynamic** — see "Server tag bonus" below |
| Staff | **Live** — best-scoring `StaffTier` among the member's held roles |
| Booster | **Live, dynamic** — see "Booster bonus" below |
| Invite | **Live, dynamic** — see "Invite bonus" below |
| Referral | **Not tracked yet.** The calculator and the resolver accept it (`UnwiredRewardBonusInputs`); it resolves to zero until a producer exists. |

### Booster bonus — current count × current continuous duration, never a stored percent

```
bonus = min(continuousDays / daysToMax(currentBoostCount), 1) × 15%      (floored to whole bp)
```

| Active boosts | Days to +15% | Day 1 |
|---|---|---|
| 1 | 60 | +0.25% |
| 2 | 45 | +0.33% |
| 3 | 30 | +0.5% |
| 4 | 15 | +1% |
| 5 | 10 | +1.5% |
| 6+ | 5 | +3% |

The table is `REWARD_BOOSTER_BONUS.daysForBoostCount`; nothing else holds these numbers. The
bonus is recomputed from the member's *current* count every claim: 6 boosts for 5 days is +15%,
and dropping to 1 boost with the same 5 continuous days is `5/60 × 15% = +1.25%` on the very next
claim. Progress is floored, so the maximum is only ever reached on the required day itself.

**State** — `RewardBoosterState` holds exactly `{guildId, discordId, boostCount,
continuousStartedAt}`; a row exists only while the member boosts. `continuousStartedAt` survives
count changes and is cleared only when boosting stops entirely.

**Discord does not expose a per-member boost count to bots.** Each signal is used for what it can
actually prove (`booster-state.ts`, all transitions pure and tested):

| Signal | Event | What it proves |
|---|---|---|
| `GuildMember.premiumSince` | `guildMemberUpdate`, and the claim-time snapshot | On/off, and Discord's own "boosting continuously since" — the period start |
| Boost announcements (`MessageType.GuildBoost*`) | `messageCreate` | The author added `n` boosts (the count goes up) |
| `Guild.premiumSubscriptionCount` drop | `guildUpdate` | Someone removed boosts — refetch the guild's boosters and reconcile |
| Member left | `guildMemberRemove` | Their boosts left with them — state cleared |

- **Start** — a new period begins at Discord's `premiumSince`, not at "when the bot noticed", so a
  bot restart or a missed event never loses progress. With no announcement seen yet the count is
  stored as `0` and treated as 1 boost (a row proves at least one); this makes a first boost count
  once whether its announcement or its `premiumSince` change arrives first.
- **Stop / zero boosts** — `premiumSince` becomes `null` → the row is deleted → +0%.
- **Increase** — each announcement adds its count (the number in a multi-boost announcement's
  content, else 1). The start is untouched.
- **Decrease** — only the guild's total says so. On a drop, the guild's members are fetched once,
  anyone no longer boosting is cleared, untracked boosters are added, and if tracked counts still
  exceed the total, every multi-booster is lowered to the smallest count consistent with it
  (`max(1, count − excess)`). With one multi-booster that is exact; with several it can
  under-count, but it never leaves anyone above what they could still have.
- **Restart / stale state** — the claim passes the member's live `premiumSince`
  (`unwired.premiumSince`), and `getBoosterProgress` applies it first: `null` clears a stale row,
  a date creates a missing one, and a `premiumSince` later than the stored start (beyond
  `samePeriodToleranceMinutes`) means the member stopped and restarted unobserved — the old count
  and start are discarded.
- Duration is never negative (a future timestamp is clamped to now), and the bonus never leaves
  `[0, +15%]`.

### Invite bonus — +1% per active credit, 10 slots, each valid 7 days from its own join

A credit (`RewardInviteCredit`) is one inviter → invitee relationship. It counts while
`expiresAt > now` **and** the invitee is still in the guild; `expiresAt` is `joinedAt + 7 days`,
per credit — there is no weekly reset. The count is taken at claim time with one indexed
`countDocuments`, so expiry needs no cleanup job, and the bonus is clamped to +10%.

- **Detection** — the invites feature (`features/invites/invites.event.ts`, see [invites.md](./invites.md)) keeps each guild's invite use counts in memory
  (seeded on `clientReady`/`guildCreate`), refetches them on every join, and `detectUsedInvite`
  names the one invite whose uses rose (or the one that vanished one use short of its `maxUses`).
  Several candidates, none (vanity URL), or an unseeded guild → no credit rather than a guess.
  Joins are processed one at a time per guild. Needs Manage Server; without it, nothing is
  attributed. No `GuildInvites` intent needed.
- **One credit per member, ever** — the unique index on `{guildId, inviteeId}` means a rejoin, a
  duplicate join event, or a second invite used by the same person can never mint another credit.
  Rows are never deleted, not even after expiry — they are the record that blocks re-crediting.
- **Leave / rejoin** — leaving sets `leftAt`, so the credit stops occupying a slot. Rejoining
  clears it: the *original* credit resumes, under its *original* `expiresAt` — never extended,
  never duplicated, never moved to whoever's invite they rejoined through.
- **Slots** — a join while the inviter already holds 10 active credits is not credited and not
  burned (no row), so that member can still be credited later. An expiry frees a slot.
- Self-invites and bot inviters are never credited. The invitee does not need to reach any
  activity threshold.

### Dynamic level bonus — no hardcoded reference level

The level bonus does **not** read a fixed "max level" constant. It is derived, every time, from
whichever levels are currently configured on the existing `LevelReward` roles — the same
`/level-rewards set|remove|list` command and the same `LevelRewardRepository.getAll(guildId)` the
level-up role grant already uses (`grant-level-rewards.ts`). No second configuration format, no
new command, no stored per-member bonus.

Each configured level's own bonus is proportional to where it sits relative to the *highest*
currently configured level, which always resolves to the full `+50%`:

```
bonus(level) = (level / highestConfiguredLevel) × 50%
```

A member's actual level is then piecewise-linearly interpolated between the two configured levels
it falls between (flat at the endpoint's bonus below the lowest, or above the highest):

```
bonus = bonusA + ((currentLevel - levelA) / (levelB - levelA)) × (bonusB - bonusA)
```

Example: with roles configured at levels 5 and 50, level 50 is the highest and is worth the full
+50%, and level 5 is worth `5/50` of it → +5%. Adding a third role at level 100 through the *same*
`/level-rewards` command makes 100 the new highest — level 50 automatically becomes worth `50/100`
of the maximum instead (+25%), with no migration and nothing recalculated or stored per member: the
next read simply sees three configured points instead of two. `resolveRewardBonuses` passes the
configured levels in fresh on every call (`levelRewards.map(r => r.level)`), so an admin changing
`/level-rewards` changes every member's bonus immediately.

### Server tag bonus — live Discord state, plus a 6-hour anti-abuse window

Discord's own "Server Tag" feature (`User.primaryGuild` in discord.js: `{ identityEnabled,
identityGuildId, tag, badge }`) already tells the bot whether a member has a guild's tag displayed
right now. `isServerTagActive(primaryGuild, guildId)` (`libs/core/src/rewards/server-tag.ts`) is the
pure, stateless decision (`identityEnabled && identityGuildId === guildId`), declared against a
small structural type rather than importing discord.js, so `libs/core` stays discord.js-free.

Being active *right now* is not enough to earn the bonus, though: a member could enable the tag
moments before claiming and disable it right after, indistinguishable at that instant from genuine
use. `server-tag-presence.ts` adds the missing piece — the tag must have been **continuously active
for at least `REWARD_SERVER_TAG_BONUS.minContinuousHours` (6h)**, timed from the first moment it was
*observed* active that UTC day:

```
member.user.primaryGuild  (live Discord state, read by the caller)
        ↓
isServerTagActive()                — pure: is it on, for this guild, right now?
        ↓
decideServerTagPresence()          — pure: has it been on for ≥6h today? what should be stored?
        ↓
resolveServerTagEligibility()      — I/O: reads/writes RewardServerTagPresence, returns the answer
        ↓
resolveRewardBonuses() → hasServerTag → serverTagBonusBp() → RewardCalculator
```

This is the one bonus that genuinely cannot be resolved from Discord's live state alone — Discord
does not expose "how long has this been on" — so `RewardServerTagPresence`
(`libs/database/src/models/RewardServerTagPresence.ts`) exists to hold exactly one fact: the first
timestamp each UTC day the tag was seen active for one member. Nothing more:

- **Removing the tag clears the row.** The next activation starts a brand new window rather than
  resuming the old one — enable, wait 3 hours, disable, re-enable and claim immediately still fails,
  because the clock restarted at the re-enable.
- **A new UTC day has no row yet**, so "each day resets the timer": however long the tag was worn
  yesterday, today's first observation always starts the 6-hour count over.
- **`markActiveSince` never moves the timestamp once set** (`$setOnInsert`), so repeated checks
  during the same continuous session cannot accidentally push the window forward.
- Nothing is ever stored beyond today's single timestamp — no history, no per-member migration if
  the rule's window length changes (`minContinuousHours` is a config constant, edited in one place).

A discord.js-aware caller supplies the raw snapshot — `unwired.primaryGuild =
member.user.primaryGuild` — and `resolveRewardBonuses` runs it through `resolveServerTagEligibility`
itself before it can become `hasServerTag`. A caller can no longer just assert `hasServerTag: true`;
the 6-hour rule is enforced inside the reward core, not left for every future caller to remember. No
caller does this yet (no bot surface calls `resolveRewardBonuses` at all), but the plumbing — from
Discord's raw state, through the anti-abuse window, to the final reward — is real and tested.

## Architecture

```
libs/constants/src/rewards.ts        Every tunable number
libs/database/src/models/
    RewardWallet.ts                  balance, lifetimeEarned, lifetimeSpent, lifetimeWithdrawn
    RewardTransaction.ts             append-only ledger, RewardTransactionType enum
    RewardServerTagPresence.ts       one timestamp per member per UTC day — the 6h window's only state
    RewardBoosterState.ts            boost count + continuous start, only while boosting
    RewardInviteCredit.ts            one row per credited invitee, ever (expiresAt, leftAt)
libs/database/src/repositories/
    RewardWalletRepository.ts        The only place a balance may move (atomic, idempotent)
    RewardTransactionRepository.ts   Ledger reads: recent(), totals()
    RewardServerTagPresenceRepository.ts   getActiveSince() / markActiveSince() / clear()
    RewardBoosterStateRepository.ts        get() / listByGuild() / save() / clear()
    RewardInviteCreditRepository.ts        credit() / countActive() / markLeft() / markRejoined()
libs/core/src/rewards/
    reward-bonus-types.ts            RewardBonusInputs, RewardBonusBreakdown
    reward-calculator.ts             Pure: calculateBonusBreakdown, calculateReward, levelBonusBp
    resolve-reward-bonuses.ts        I/O: reuses StaffTier/Streak/ActivityXP/LevelReward/ServerTag
    reward-wallet-service.ts         creditReward / debitReward / withdrawReward
    format-credits.ts                Internal unit ⇄ "Credits" display, isolated
    claim-reward.ts                  claimReward() — the one entry point a source calls
    server-tag.ts                    Pure: isServerTagActive() — Discord's own primaryGuild data
    server-tag-presence.ts           Pure: decideServerTagPresence(); I/O: resolveServerTagEligibility()
    booster-state.ts                 Pure: applyPremiumSince/applyBoostAnnouncement/reconcileBoostCounts; I/O: getBoosterProgress()
    invite-credit.ts                 Pure: detectUsedInvite/decideInviteCredit/isInviteCreditActive; I/O: recordInviteeJoin()
    sources/
        activity-reward-tiers.ts     Pure: reachedActivityRewardTiers, idempotency key builder
        activity-reward-source.ts    The reward-source engine: progress → tiers → claimReward()
        message-reward-source.ts     claimMessageRewards() — reads PeriodicStat "messages"
        voice-reward-source.ts       claimVoiceRewards() — reads PeriodicStat "voiceTime"
apps/bot/src/events/rewards/         discord.js side — state only, never pays
    reward-booster-tracking.event.ts guildMemberUpdate / messageCreate / guildUpdate / guildMemberRemove
apps/bot/src/features/invites/       invite tracking — also feeds /invites, /info and join announcements (invites.md)
apps/bot/src/utils/guild-queue.ts    per-guild serialization for both
```

`claimReward` is the seam every future reward source is meant to use:

```ts
await claimReward({
    guildId, discordId, username, roleIds,
    baseUnits: 5,               // from REWARD_BASE_VALUES, not connected to live counters yet
    type: "MESSAGE_REWARD",
    idempotencyKey: `message-reward:${guildId}:${discordId}:${dayKey}`,
});
```

It resolves bonuses, runs the formula, and — only if the final amount is positive — credits the
wallet through `reward-wallet-service.ts`, which is the single place `RewardWallet` may be written.
No event handler, command or scheduler should call `RewardWalletRepository.move` directly.

## Message and voice rewards

Neither tracks anything new. Both read progress that the existing activity systems already write
to `PeriodicStat`'s `"daily"` bucket:

```
message-stats.event.ts  → PeriodicStatRepository.incrementAllPeriods(guildId, "messages", ...)
run-voice-tick.ts       → PeriodicStatRepository.incrementAllPeriods(guildId, "voiceTime", ...)  (seconds)
```

`createActivityRewardSource` (`sources/activity-reward-source.ts`) is the one reward-source engine
both are built from — read today's progress for one metric, work out which configured tiers
(`REWARD_BASE_VALUES.message` / `.voice`) it has reached, and claim each one exactly once per day:

```
PeriodicStat (existing, read-only)
        ↓
reachedActivityRewardTiers()        — pure: which tiers does today's progress meet?
        ↓
claimReward()  (one call per reached tier, keyed message-reward:<guild>:<user>:<utcDay>:<threshold>)
        ↓
RewardCalculator → RewardWallet → RewardTransaction
```

Each tier is independent — 600 daily messages claims *both* the 300 and the 600 milestone in the
same call, the same way a streak reward table pays every threshold crossed rather than only the
highest. Idempotency is the existing mechanism (`RewardTransaction.idempotencyKey`'s partial unique
index via `RewardWalletRepository.move`) — a claim that runs twice for the same guild, member, UTC
day and threshold collides on the same key and pays once. `message-reward-source.ts` and
`voice-reward-source.ts` are thin configurations of the shared engine (metric name, tier table,
transaction type, detail text) — nothing about message or voice counting was changed to support
this.

No command or scheduler calls `claimMessageRewards`/`claimVoiceRewards` yet — see "not built yet".

## Currency display

Internally an integer unit. Never shown to a member as-is: `formatCredits(units)` scales it
(`CREDITS_DISPLAY.displayScale`, 1 unit → 1,000,000 Credits) and labels it "Credits" — a member
never sees "RC" or the internal number. `5` units → `"5M Credits"`, matching the base
reward table (300 daily messages → 5 units → 5M Credits; 600 → 50 units → 50M Credits).

## What is deliberately not built yet

- No `/rewards`-style command or scheduler that actually calls `claimMessageRewards` /
  `claimVoiceRewards` — the pipeline reaches `RewardTransaction`, but nothing in the bot invokes it
  yet, and `/profile` is untouched.
- No referral tracking — only the bonus math it will feed. Server tag, booster and invite are fully
  wired, each with the smallest state its rule needs.
- No withdrawal/conversion flow beyond the wallet primitive (`withdrawReward` moves the balance and
  writes a `WITHDRAW` ledger row; nothing decides an exchange rate yet).

## Checks

```
bun run test:rewards
```

No database, no gateway — everything here is pure logic. Covers: the calculator (normal user,
level-only, staff-only, combined, maxed, zero/invalid input, booster-after-losing-boosts); the
dynamic level bonus (zero/one/two/three configured points, below/on/between/above the configured
range, arbitrary/unsorted/duplicated input, no hardcoded reference level, integer safety,
determinism); the streak bonus (every named day-count from the spec, the +10% cap, integer safety);
the server tag bonus (inactive/active, disabling/re-enabling with nothing stored, `isServerTagActive`
against a matching/mismatched/disabled/absent `primaryGuild`); the server tag 6-hour presence window
(`decideServerTagPresence`: enabling right before a claim fails, just-short/exactly-on/past-the-window
boundaries, an existing timestamp preserved rather than rewritten, and the full remove-then-re-enable
story — removing it clears the window and re-enabling starts a new one rather than resuming the old);
the booster curve (every boost count's progression, 6 → 1 recalculating to +1.25%, 10 boosts
using the 6-boost row, clamp, negatives, integer precision) and its state transitions (start, stop,
increase, decrease, first boost counted once in either event order, exact and ambiguous
reconciliation, restart from `premiumSince`, stale periods, guild resync); the invite bonus
(0/1/5/10/11 credits, exact-instant expiry, independent expiry, slots freeing, `detectUsedInvite`,
and the real `recordInviteeJoin`/`recordInviteeLeave` against an in-memory store — duplicate join
events, leave, rejoin through the same or another invite, full slots); integration checks (server tag +
streak combining additively, the spec's own worked example with level + streak + server tag +
staff, the booster + invite example (+46.5%, 50M × 1.4 × 1.465), bonuses composing with the staff
multiplier, no duplicate application across repeated resolution); and the message/voice reward sources (below/at/above threshold, multiple tiers reached
at once, idempotency-key determinism and collision-freedom, bonuses composing through the existing
calculator). The DB-touching orchestration in `activity-reward-source.ts`, `claim-reward.ts` and
`resolveServerTagEligibility` is intentionally thin and trusted the same way `PointsRepository.move`
is — all the actual decision logic they call (`decideServerTagPresence` included) is pure and fully
covered; the repository calls around it are simple reads/writes with no branching left to test.

## Related

- [economy.md](./economy.md) — Points and RC, and how they differ from Credits
- [streak.md](./streak.md) — the system the streak bonus reads from
- `apps/bot/src/commands/guild/admin/level-rewards.command.ts` — the single source of truth for
  configured level-reward levels; `libs/database/src/repositories/LevelRewardRepository.ts` is the
  only place that reads or writes them
