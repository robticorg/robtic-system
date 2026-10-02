import { Events, MessageType, type GuildMember } from "discord.js";
import type { EventConfig } from "@typings/event";
import { queueBoostThanks } from "./functions/thank-booster";

/**
 * A boost reaches the bot two ways, and neither alone is enough:
 *
 * - the "X just boosted the server" system message — every boost, but only if the server shows
 *   those messages;
 * - `premiumSince` going from empty to set — always, but only for a member's first boost.
 *
 * Both are listened to. Each adds the booster to the guild's batch (`queueBoostThanks`), which thanks
 * everyone together once 30 minutes pass with no new boost — a member is never listed twice.
 */

const BOOST_MESSAGES: ReadonlySet<MessageType> = new Set([
    MessageType.GuildBoost,
    MessageType.GuildBoostTier1,
    MessageType.GuildBoostTier2,
    MessageType.GuildBoostTier3,
]);


export default [
    {
        name: Events.MessageCreate,
        execute: message => {
            if (!message.guild || !BOOST_MESSAGES.has(message.type) || message.author.bot) return;
            queueBoostThanks(message.guild, message.author.id);
        },
    } satisfies EventConfig<Events.MessageCreate>,

    {
        name: Events.GuildMemberUpdate,
        execute: (oldMember, newMember) => {
            const member = newMember as GuildMember;
            // A partial old member has no premiumSince to compare, so it can't prove a new boost.
            if (member.user.bot || oldMember.partial || oldMember.premiumSince || !member.premiumSince) return;
            queueBoostThanks(member.guild, member.id);
        },
    } satisfies EventConfig<Events.GuildMemberUpdate>,
];
