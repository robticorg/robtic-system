import { Events, MessageType, type GuildMember } from "discord.js";
import type { EventConfig } from "@typings/event";
import { handleError, BotError } from "@core/handlers";
import { thankBooster } from "./functions/thank-booster";

/**
 * A boost reaches the bot two ways, and neither alone is enough:
 *
 * - the "X just boosted the server" system message — every boost, but only if the server shows
 *   those messages;
 * - `premiumSince` going from empty to set — always, but only for a member's first boost.
 *
 * Both are listened to; `thankBooster` sends one thank-you when both arrive for the same boost.
 */

const BOOST_MESSAGES: ReadonlySet<MessageType> = new Set([
    MessageType.GuildBoost,
    MessageType.GuildBoostTier1,
    MessageType.GuildBoostTier2,
    MessageType.GuildBoostTier3,
]);

function report(err: unknown): void {
    handleError(new BotError(`Failed to thank a booster: ${err}`, "EVENT"), "main/boost");
}

export default [
    {
        name: Events.MessageCreate,
        execute: message => {
            if (!message.guild || !BOOST_MESSAGES.has(message.type) || message.author.bot) return;
            return thankBooster(message.guild, message.author.id).catch(report);
        },
    } satisfies EventConfig<Events.MessageCreate>,

    {
        name: Events.GuildMemberUpdate,
        execute: (oldMember, newMember) => {
            const member = newMember as GuildMember;
            // A partial old member has no premiumSince to compare, so it can't prove a new boost.
            if (member.user.bot || oldMember.partial || oldMember.premiumSince || !member.premiumSince) return;
            return thankBooster(member.guild, member.id).catch(report);
        },
    } satisfies EventConfig<Events.GuildMemberUpdate>,
];
