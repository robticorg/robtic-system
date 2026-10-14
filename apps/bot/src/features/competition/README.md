# TEMP — Competition bot

A temporary bot for one competition. When the competition is over, delete everything listed under
**What to delete**. Nothing else in the project depends on it.

## How it works

- `/create bot token:` (on the main bot, admins only) checks the token, saves it **encrypted**
  (same `MUSIC_TOKEN_KEY` as music bots) and logs that bot in. The main bot runs it inside its own
  process, so it is online whenever the main bot is.
- It stays online: discord.js reconnects on its own, and a watchdog logs it in again if it is
  offline for 2 minutes (or never managed to log in). When the main bot restarts, the bot comes back
  with it. All state is in MongoDB, so nothing is lost and old buttons keep working.
- It is locked to the server where `/create` was used (it leaves any other server).
- Running `/create bot` again replaces the bot's token but keeps the competition.

In the Developer Portal, the competition bot needs **Message Content Intent** turned on. The emojis
(`minidot`, `info`, `add`) are in another server, so on start the bot copies them into its own
**application emojis** (Developer Portal → your app → Emojis), which work in every server.

## Commands (prefix `!`, members with Manage Server only)

| Command | What it does |
|---|---|
| `!set-room #channel` | Where participant posts are sent (without it: the channel `!register` is used in) |
| `!register <userID>` + image | Posts `<minidot> **#N <@user>**`, the image, a separator and `images/line.png`, then a line message after it |
| `!start` | Opens voting — adds the buttons `<add>\| تـصـويـت` and `<info>\| N Votes` (disabled, just shows the count) to every post |
| `!end` | Ends the competition — removes every button |
| `!hide` | Hides the vote-count button (use again to show it) |
| `!check #N` | Invites, fake invites, votes from people they invited / didn't invite, total, and votes without fakes and without who left |
| `!remove #N` | Post stays as `<minidot> ~~**#N <@user>**~~`, no buttons; their voters can vote again |
| `!delete #N` | Deletes the participant completely — post, votes and number; the next `!register` reuses the lowest free number |
| `!reset` | Wipes the whole competition — every post, vote and the leaderboard (asks you to type `confirm`). The room and the bot stay |
| `!leaderboard` | Posts the top 10 (current votes + current invites), refreshed every 5 minutes with the last refresh time |
| `!dm` / `!dm #N` / `!dm >N` / `!dm <N` / `!dm =N` | Asks for the message, then DMs the matching participants |
| `!help` | The list above |

`!dm` variables: `[user]` mention, `[post]` link to their post, `[vote]` their votes,
`[Label;https://link]` a link button (e.g. `[Go to post;[post]]`).

Voting: one vote per member in the whole competition. Pressing the same participant's vote button again
shows "لقد قمت بالتصويت على هذا المتسابق مسبقا هل تريد ازالة تصويت ؟" with a red **ازالة التصويت** button.
Nobody can vote for themselves. Every post is followed by a separate `line.png` message (deleted with the post). "Current votes" on the leaderboard = votes from members still in the server.

## What to delete

1. This folder: `apps/bot/src/features/competition/`
2. In `apps/bot/src/services/gateway-leadership/index.ts`: the line
   `import { stopAllCompetitionBots } ... // TEMP competition bot` and `stopAllCompetitionBots(),`
   inside `logOutEverywhere()`.
3. In `apps/bot/src/events/prefix-command-router.event.ts`: the line
   `import { isCompetitionCommand } ... // TEMP competition bot` and the line
   `if (isCompetitionCommand(...)) return; // TEMP ...`.
4. MongoDB collections: `tempcompetitionbots`, `tempcompetitionentries`, `tempcompetitionvotes`.
5. Kick the competition bot from the server (and reset its token in the Developer Portal).
6. The `/create` slash command disappears on the next command registration (deploy).

`grep -rn "competition" apps/bot/src` should then find nothing.
