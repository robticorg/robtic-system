# Discord Streak Bot - Development Specification

## Objective

Build a production-ready Discord Streak Bot using **discord.js**, **TypeScript**, and **Redis**.

The bot encourages members to chat daily in designated channels. A streak increases once every 24 hours when the user sends a valid message.

The bot must be scalable, modular, and suitable for large public Discord servers.

---

# Core Rules

## Streak Window

```text
Day 1
User sends message
→ Streak = 1

24 hours later
↓
User becomes eligible for the next streak.

24h–48h
↓
If the user sends another valid message
→ Streak++

48 hours with no valid message
↓
Streak expires
```

### Rules

- One streak increase every 24 hours.
- User has an additional 24-hour grace period.
- Redis TTL is always reset to **48 hours** after each successful streak.

---

# Guild Configuration

Each server can configure one or more streak channels.

## Commands

```text
/streak channel add #general
/streak channel remove #general
/streak channel list
```

Only configured channels count toward streaks.

---

# Valid Message Rules

A message counts only if it:

- Is not sent by a bot
- Is not sent by a webhook
- Has at least the minimum configured length (default: 5)
- Is not emoji-only
- Is not attachment-only
- Is not spam
- Is not duplicate content

---

# Redis Structure

## Active Streak

Key

```text
guild:{guildId}:streak:{userId}
```

Fields

```text
currentStreak
bestStreak
lastIncrement
lastMessage
reminderSent
```

TTL

```text
48 hours
```

---

## Recovery Record

When a streak expires:

```text
guild:{guildId}:streakReturn:{userId}
```

Fields

```text
currentStreak
bestStreak
expiredAt
```

TTL

```text
3 days
```

Only administrators can restore from this record.

---

# Message Flow

1. User sends a message.
2. Check whether the channel is configured.
3. Validate the message.
4. Check whether 24 hours have passed since the previous streak increment.
5. If not eligible, ignore.
6. If eligible:
   - Increment streak.
   - Update best streak.
   - Reset Redis TTL to 48 hours.
   - Reset reminder flag.
7. Reply publicly.
8. Send a DM.

---

# Public Reply

Reply to the triggering message.

Example

```text
🔥 Streak 17!

Come back tomorrow to continue your streak.
```

Automatically delete after 10 seconds (configurable).

---

# Private DM

```text
🔥 Daily streak updated!

Current Streak: 17
Best Streak: 42

Next streak available tomorrow.
```

If DMs are disabled, ignore the error.

---

# Reminder System

Run every 15 minutes.

Conditions:

- Remaining TTL ≤ 2 hours
- reminderSent == false

Send

```text
⚠️ Your streak will expire in less than 2 hours.

Send one message in the streak channel to keep your streak alive.
```

Then set

```text
reminderSent = true
```

---

# Expired Notification

When Redis expires the key:

- Send DM

```text
💔 Your streak has expired.

Lost streak: 37

An administrator can restore it within 3 days.
```

- Create the recovery record.

Prefer Redis Keyspace Notifications.

---

# Recovery Command

Administrator only.

```text
/streak return @user
```

Rules

- Recovery record exists.
- Recovery is less than 3 days old.

Restore

- Current streak
- Best streak
- lastIncrement = now
- TTL = 48 hours

Delete the recovery record after restoration.

---

# User Commands

## /streak

Display

- Current streak
- Best streak
- Time until next streak
- Time until expiration
- Current leaderboard rank
- Reminder status

Example

```text
🔥 Current Streak: 17
🏆 Best Streak: 41
⏳ Next Streak: 13h 24m
💔 Expires In: 37h
📈 Rank: #4
```

---

## /streak top

Display the Top 5 current streaks.

Buttons

- Current
- Best Ever

Switch between:

- Current leaderboard
- Historical best leaderboard

---

# Configuration Commands

```text
/streak channel add
/streak channel remove
/streak channel list

/streak reminder default on
/streak reminder default off

/streak settings
```

---

# Permissions

## Administrator

- Channel configuration
- Recovery command
- Settings

## Everyone

- /streak
- /streak top

---

# Anti-Abuse

Ignore

- Bots
- Webhooks
- Duplicate messages
- Spam bursts
- Messages below minimum length

Optional

- Ignore multiple messages within 10 seconds.

---

# Project Structure

```text
src/
├── commands/
│   └── streak/
├── events/
│   └── messageCreate.ts
├── services/
│   ├── StreakService.ts
│   ├── ReminderService.ts
│   ├── LeaderboardService.ts
│   └── RecoveryService.ts
├── repositories/
│   └── RedisRepository.ts
├── jobs/
│   └── ReminderJob.ts
├── components/
│   └── LeaderboardButtons.ts
└── utils/
    └── Time.ts
```

---

# Service Responsibilities

## StreakService

- Validate messages
- Handle the 24-hour rule
- Increment streaks
- Reset TTL
- Send public replies
- Send DMs

## ReminderService

- Process reminder queue
- Send reminder DMs
- Reset reminder flags

## RecoveryService

- Create recovery records
- Restore streaks
- Delete recovery records

## LeaderboardService

- Current leaderboard
- Best-ever leaderboard
- User ranking

---

# Scalability Requirements

- Support millions of users.
- O(1) Redis operations during message processing.
- Avoid scanning Redis keys by maintaining a reminder schedule using Redis Sorted Sets.
- Use Redis TTL for automatic expiration.
- Use Redis Keyspace Notifications for expiration events.
- Background jobs must be restart-safe.
- Guild data must remain isolated.
- Fully typed TypeScript.
- Ready for Discord sharding.
- Ready for horizontal scaling.
- All timing values (24h claim, 48h expiration, 2h reminder, 3-day recovery) must be configurable.
- Embed colors, emojis, messages, and auto-delete duration should be configurable.