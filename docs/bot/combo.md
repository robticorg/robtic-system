# Combo System — Development Specification

> Version: 1.0

---

# Overview

The Combo System is a social engagement system that measures the quality and consistency of conversations between members.

Unlike a normal message counter, a Combo represents an active conversation between two users.

The system should encourage real conversations rather than message farming.

The bot should **never announce** when a combo starts or ends.
Everything happens silently in the background.

---

# Core Principles

- Combo belongs to **two users**, not one.
- Every combo has its own score.
- Users inherit their highest active combo.
- Multiple combos may exist simultaneously.
- Combos automatically expire.
- Everything should be designed for large Discord servers.

---

# Conversation Detection

Discord doesn't provide conversation information.

The bot must infer who a user is talking to.

Conversation detection should use a weighted confidence system.

Possible signals include:

- Reply
- Mention
- Previous conversation partner
- Alternating messages
- Time between messages
- Existing conversation score

The AI is responsible for implementing a robust conversation detection algorithm.

The goal is to mimic how humans naturally identify conversations.

---

# Combo Rules

A combo begins automatically when two users start exchanging messages.

The bot should never send any notification.

The combo continues while both users are still interacting.

If conversation shifts naturally to another user,
the combo should eventually end.

The combo expires after **2 minutes** without interaction.

---

# Combo Score

Each combo owns its own score.

Example

A ↔ B

Score

81

A ↔ C

Score

41

User score

A = 81

B = 81

C = 41

Users always display the highest active combo they currently own.

---

# Combo Levels

Each combo belongs to a level.

Example

Bronze

Silver

Gold

Diamond

Legendary

Levels are configurable.

---

# Conversation Heat

Every combo has a Heat value.

Heat represents how "alive" the conversation currently is.

Heat ranges from

0%

to

100%

Heat increases when:

- users alternate messages
- messages are meaningful
- replies happen quickly

Heat decreases over time.

Long pauses decrease Heat.

Heat reaching zero does NOT immediately end a combo.

The combo still follows the normal timeout rules.

Heat is used only for statistics and UI.

Example

🔥 Heat

96%

Status

Very Active

---

# Combo Duration

Track

- total duration
- total messages
- average message length
- words
- characters

---

# Favorite Partner

Each user has a Favorite Partner.

Calculated from:

- total combo score
- total combo duration
- number of conversations

Displayed inside Combo Profile.

---

# Conversation Streak

Separate from the normal daily streak.

A Conversation Streak measures how many consecutive days
two users successfully had at least one combo.

Missing one day resets the streak.

Track

Current

Best

---

# Combo History

Store previous combos.

History includes

- partner
- duration
- score
- level
- ended date

---

# Server Records

Track records for

Highest Combo Ever

Longest Conversation

Most Messages

Longest Conversation Streak

Highest Heat

Most Active Partner

---

# Leaderboards

Support

Daily

Weekly

Monthly

All Time

Leaderboards should exist for

Highest Combo

Conversation Streak

Favorite Partner Score

---

# Champion Role

Server administrators can configure one role.

The role is automatically assigned to every member
who currently owns the highest active combo score.

Example

A

114

B

81

C

114

Role holders

A

C

If rankings change

The role should automatically move.

Role updates should be optimized to avoid Discord rate limits.

---

# Commands

There is only one public command.

```
/combo
```

Everything else is accessed using message components.

The first page is always

## Status

Display

- Current highest combo
- Current level
- Heat
- Favorite partner
- Conversation streak
- Current ranking
- Active combos

---

## Navigation

Select Menu ( Drop Down )

Status

Statistics

History

Leaderboards

Server Records

Settings (Admins)

---

# Statistics Page

Display

Current Combo

Best Combo

Favorite Partner

Current Conversation Streak

Best Conversation Streak

Total Conversations

Different Partners

Messages

Average Combo

Average Duration

Longest Conversation

---

# History Page

Display previous combos.

Each item shows

Partner

Score

Duration

Level

Ended

---

# Leaderboards

Allow switching between

Daily

Weekly

Monthly

All Time

Leaderboard types

Highest Combo

Conversation Streak

Favorite Partner

---

# Server Records

Display

Highest Combo Ever

Longest Conversation

Most Messages

Highest Heat

Longest Conversation Streak

---

# Storage

Combos belong to pairs.

Users should not directly own combo scores.

Example

pair:A:B

Current Score

Best Score

Messages

Duration

Heat

Level

Conversation Streak

Status

Started At

Updated At

---

# Architecture

Suggested modules

```
ComboService

ConversationDetector

HeatCalculator

LevelCalculator

ConversationStreakService

HistoryService

LeaderboardService

FavoritePartnerService

RecordService

ChampionRoleService

ComboRepository
```

---

# Scalability

- Ready for millions of users
- Redis-first architecture
- No full scans
- Queue expensive operations
- Optimized role updates
- Ready for sharding
- Horizontal scaling support

---

# AI Implementation Instructions

Before implementing anything, the AI **must read `combo.md`** completely.

The implementation must follow that specification.

The AI may improve algorithms internally, but **must not change user-facing behavior** without explicit approval.

Implementation priorities:

1. Correctness
2. Scalability
3. Low Redis usage
4. Clean architecture
5. Modular services
6. Easy future expansion

The AI should particularly focus on:

- Conversation detection
- Conversation heat algorithm
- Combo scoring algorithm
- Performance for large public Discord servers
- Extensible architecture

Whenever implementation details are ambiguous, the AI should choose the solution that best preserves natural conversation detection while minimizing false positives.