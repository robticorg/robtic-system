# Invites

`apps/bot/src/features/invites/` — who brought whom into the server. `default-on`, but nothing is
posted until an admin picks a channel.

## Commands

| Command | Access | What it does |
|---|---|---|
| `/invites-config channel [channel]` | admin | Where each join and leave is announced. Leave `channel` empty to stop announcing (tracking continues). |
| `/invites [user]` | everyone | Joins, Leaves, Fake, the live Invite reward Bonus, and invites this week. Footer: invites in total. |
| `/info [user]` | everyone | Everyone the member invited, newest first, 10 per page, Prev/Next buttons (only the opener can page). Each line: the member, how long ago they joined, `(Available)`, `(Left Server)` or `(Fake)`. |

### In ticket channels, without a prefix

In a text channel named `ticket-…` that the ticket bot (`INVITES_CONFIG.ticketBotId`) created,
anyone can type `info @user` or `invites @user` (a raw user id works too; no user means yourself)
and get the same reply as the slash command. Anything else typed there is ignored.

Which channels qualify is cached in memory. A channel is recognised when it is created (from the
audit log, so the bot needs **View Audit Log**), when the ticket bot posts in it, or — after a
restart — on the first query, by asking the audit log once.

## Announcements

```
**@member** has arrived by using the vanity invite **robtic**.
**@member** just joined. They were invited by **.30g** who now has **7 invites !**
**@member** just joined, but I couldn't tell which invite they used.

**raouf._.159** has left. They were invited by **robo._.38**.
**raouf._.159** has left. They were invited using a vanity invite.
**c_iot** has left but I haven't registered who invited them.
```

Nobody is pinged. Wording lives in `utils/invite-format.ts`.

## Numbers

| Shown as | Meaning |
|---|---|
| Joins | Real joins through this member's invites |
| Leaves | Those real joins where the member has since left |
| Fake | Rejoins inside the fake window (below) — listed, never credited |
| Invites in total (and "now has N invites") | Joins − Leaves, never below 0 |
| Invites this week | Real joins in the last 7 days that are still in the server — a rolling window (`INVITES_CONFIG.recentWindowDays`), not a calendar week |
| Bonus | The live Invite reward bonus: +1% per active credit, +10% max — the same number `claimReward` uses (see [rewards.md](./rewards.md)) |

### Fake joins

A join is fake when the same member already has a **real** join in this server within the last
30 days (`INVITES_CONFIG.fakeWindowDays`), whoever invited them either time. So join → leave →
rejoin a week later is fake for the second inviter.

Once 30 days have passed since that real join, the next join counts as real again — and opens a
new 30-day window in which further rejoins are fake. Decided once at join time and stored on the
row (`InviteJoin.fake`); rows from before this existed count as real.

## How a join is attributed

`invites.event.ts` is the only invite tracker. It keeps every guild's invite use counts in memory
(seeded on `clientReady`/`guildCreate`, refetched on each join), plus the vanity URL's counter, and
`detectUsedInvite` picks the one counter that went up. Several at once, or none, is recorded as
unknown rather than guessed. Joins and leaves are processed one at a time per guild.

Each join then feeds, in order:

1. The Invite reward credit (`recordInviteeJoin`) — once per member ever, 10 slots, 7 days each.
   Vanity and unknown joins never earn one.
2. `InviteJoin` — one row per join, fake flag included (the history behind the counts above).
   Leaving sets `leftAt` on the member's latest join; rows are never deleted. A replayed join event
   collides on `{guildId, inviteeId, joinedAt}` and is neither recorded nor announced twice.
3. The announcement — only if the feature is enabled and a channel is set.

Steps 1 and 2 run even while the feature is disabled, so counts and the reward bonus are already
right when it is turned on. Leaves follow the same pattern: close the row, then announce.

## Limits

- The bot needs **Manage Server** to read invites (and the vanity counter); without it every join
  is "unknown".
- Joins before this feature existed, and leaves while the bot was offline, are not in the history.
  A member who left during downtime shows as Available until their next join/leave is seen, and
  their leave is announced as unregistered.
- A single-use invite created *and* used between two joins cannot be seen without the
  `GuildInvites` intent, which the bot does not request.
- Ticket channels older than Discord's 45-day audit-log retention are only recognised once the
  ticket bot posts in them again.

## Checks

```
bun run test:invites
```

The exact join and leave wording, totals, bonus formatting, the fake window, ticket queries,
`/info` paging and button ids, vanity detection, and the manifest.
