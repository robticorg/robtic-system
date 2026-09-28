# Invites

`apps/bot/src/features/invites/` — who brought whom into the server. `default-on`, but nothing is
posted until an admin picks a channel.

## Commands

| Command | Access | What it does |
|---|---|---|
| `/invites-config channel [channel]` | admin | Where each join is announced. Leave `channel` empty to stop announcing (tracking continues). |
| `/invites [user]` | everyone | Joins, Leaves, the live Invite reward Bonus, and invites this week. Footer: invites in total. |
| `/info [user]` | everyone | Everyone the member invited, newest first, 10 per page, Prev/Next buttons (only the opener can page). Each line: the member, how long ago they joined, `(Available)` or `(Left Server)`. |

## Join announcements

```
**@member** has arrived by using the vanity invite **robtic**.
**@member** just joined. They were invited by **.30g** who now has **7 invites !**
**@member** just joined, but I couldn't tell which invite they used.
```

Nobody is pinged — the mention only renders the name. Wording lives in
`utils/invite-format.ts`.

## Numbers

| Shown as | Meaning |
|---|---|
| Joins | Every join through this member's invites, rejoins included |
| Leaves | Those joins where the member has since left |
| Invites in total (and "now has N invites") | Joins − Leaves, never below 0 |
| Invites this week | Joins in the last 7 days — a rolling window (`INVITES_CONFIG.recentWindowDays`), the same length as an invite credit, not a calendar week |
| Bonus | The live Invite reward bonus: +1% per active credit, +10% max — the same number `claimReward` uses (see [rewards.md](./rewards.md)) |

## How a join is attributed

`invites.event.ts` is the only invite tracker. It keeps every guild's invite use counts in memory
(seeded on `clientReady`/`guildCreate`, refetched on each join), plus the vanity URL's counter, and
`detectUsedInvite` picks the one counter that went up. Several at once, or none, is recorded as
unknown rather than guessed. Joins and leaves are processed one at a time per guild.

Each join then feeds, in order:

1. The Invite reward credit (`recordInviteeJoin`) — once per member ever, 10 slots, 7 days each.
   Vanity and unknown joins never earn one.
2. `InviteJoin` — one row per join (the history behind the counts above). Leaving sets `leftAt`
   on the member's latest join; rows are never deleted. A replayed join event collides on
   `{guildId, inviteeId, joinedAt}` and is neither recorded nor announced twice.
3. The announcement — only if the feature is enabled and a channel is set.

Steps 1 and 2 run even while the feature is disabled, so counts and the reward bonus are already
right when it is turned on.

## Limits

- The bot needs **Manage Server** to read invites (and the vanity counter); without it every join
  is "unknown".
- Joins before this feature existed, and leaves while the bot was offline, are not in the history.
  A member who left during downtime shows as Available until their next join/leave is seen.
- A single-use invite created *and* used between two joins cannot be seen without the
  `GuildInvites` intent, which the bot does not request.

## Checks

```
bun run test:invites
```

The exact announcement wording, totals, bonus formatting, `/info` paging and button ids, vanity
detection, and the manifest.
