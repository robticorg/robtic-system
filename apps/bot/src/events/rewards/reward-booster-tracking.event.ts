import { Events, MessageType, type Guild, type GuildMember, type Message } from "discord.js";
import type { EventConfig } from "@typings/event";
import { handleError, BotError } from "@core/handlers";
import {
    observeBoosterPremiumSince,
    recordBoostAnnouncement,
    clearBoosterState,
    syncGuildBoosters,
} from "@core/rewards";
import { createGuildQueue } from "@bot/utils/guild-queue";

/**
 * Keeps `RewardBoosterState` in step with Discord — state only, never a reward. The Booster bonus
 * is computed from that state when a reward is claimed (`resolveRewardBonuses`).
 *
 * Purely event-driven; nothing polls members:
 *
 * - `guildMemberUpdate` — `premiumSince` changed: the member started boosting (a new period from
 *   Discord's own timestamp) or stopped entirely (state cleared, +0%).
 * - `messageCreate` — a boost announcement: its author added boosts (the count goes up).
 * - `guildUpdate` — the guild's boost total dropped: one member may have removed *some* of their
 *   boosts, which no per-member event reports. The guild's boosters are refetched and the counts
 *   reconciled against the new total (`planGuildBoosterSync`).
 * - `guildMemberRemove` — a member's boosts leave with them.
 *
 * A bot restart needs no catch-up pass: the next claim's live `premiumSince` snapshot corrects
 * on/off and the start date, and the next total drop reconciles counts.
 */

const CTX = "main/reward-booster-tracking";
const enqueue = createGuildQueue();

/** `MessageType.GuildBoost*` — Discord's "X just boosted the server" announcements. */
const BOOST_ANNOUNCEMENTS: ReadonlySet<MessageType> = new Set([
    MessageType.GuildBoost,
    MessageType.GuildBoostTier1,
    MessageType.GuildBoostTier2,
    MessageType.GuildBoostTier3,
]);

/** Gateway replays after a resume can deliver a message twice; each announcement counts once. */
const recentAnnouncements = new Set<string>();
const RECENT_ANNOUNCEMENT_LIMIT = 500;

function firstSeen(messageId: string): boolean {
    if (recentAnnouncements.has(messageId)) return false;
    recentAnnouncements.add(messageId);
    if (recentAnnouncements.size > RECENT_ANNOUNCEMENT_LIMIT) {
        recentAnnouncements.delete(recentAnnouncements.values().next().value!);
    }
    return true;
}

/** A multi-boost announcement carries the number of boosts as its content ("… boosted the server 3 times"). */
function announcedBoosts(message: Message): number {
    const count = Number.parseInt(message.content, 10);
    return Number.isInteger(count) && count >= 1 ? count : 1;
}

function report(err: unknown, what: string): void {
    handleError(new BotError(`Failed to ${what}: ${err}`, "EVENT"), CTX);
}

async function resyncGuild(guild: Guild): Promise<void> {
    const members = await guild.members.fetch();
    const boosters = members
        .filter(member => !member.user.bot && member.premiumSince !== null)
        .map(member => ({ discordId: member.id, premiumSince: member.premiumSince! }));

    await syncGuildBoosters(guild.id, boosters, guild.premiumSubscriptionCount);
}

export default [
    {
        name: Events.GuildMemberUpdate,
        execute: (oldMember, newMember) => {
            const member = newMember as GuildMember;
            if (member.user.bot || oldMember.premiumSinceTimestamp === member.premiumSinceTimestamp) return;

            return enqueue(member.guild.id, () => observeBoosterPremiumSince(member.guild.id, member.id, member.premiumSince).then(() => undefined))
                .catch(err => report(err, "record a boost state change"));
        },
    } satisfies EventConfig<Events.GuildMemberUpdate>,

    {
        name: Events.MessageCreate,
        execute: message => {
            if (!message.guild || !BOOST_ANNOUNCEMENTS.has(message.type) || message.author.bot) return;
            if (!firstSeen(message.id)) return;

            const guildId = message.guild.id;
            return enqueue(guildId, () => recordBoostAnnouncement(
                guildId,
                message.author.id,
                announcedBoosts(message),
                message.member?.premiumSince ?? null,
                message.createdAt,
            )).catch(err => report(err, "record a boost announcement"));
        },
    } satisfies EventConfig<Events.MessageCreate>,

    {
        name: Events.GuildUpdate,
        execute: (oldGuild, newGuild) => {
            const before = oldGuild.premiumSubscriptionCount;
            const after = newGuild.premiumSubscriptionCount;
            if (before === null || after === null || after >= before) return;

            return enqueue(newGuild.id, () => resyncGuild(newGuild))
                .catch(err => report(err, "reconcile booster counts"));
        },
    } satisfies EventConfig<Events.GuildUpdate>,

    {
        name: Events.GuildMemberRemove,
        execute: member => {
            if (member.user?.bot) return;

            return enqueue(member.guild.id, () => clearBoosterState(member.guild.id, member.id))
                .catch(err => report(err, "clear a departed member's boost state"));
        },
    } satisfies EventConfig<Events.GuildMemberRemove>,
];
