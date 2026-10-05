import { ChannelType, Events, type Guild } from "discord.js";
import type { EventConfig } from "@typings/event";
import { INVITES_CONFIG } from "@constants";
import { handleError, BotError } from "@core/handlers";
import { Logger } from "@logger";
import { detectUsedInvite } from "@core/rewards";
import { createGuildQueue } from "@bot/utils/guild-queue";
import { fetchInviteUses, getInviteUses, setInviteUses, forgetInviteUses } from "./utils/invite-use-cache";
import { answerTicketQuery } from "./functions/answer-ticket-query";
import { submitInviteJoin, submitInviteLeave } from "./functions/submit-invite-event";
import { parseTicketQuery } from "./utils/invite-format";
import { createdByTicketBot, forgetTicketChannel, hasTicketName, rememberTicketChannel } from "./utils/ticket-channels";

/**
 * The one place invites are tracked. Each join is attributed once, then feeds three things:
 *
 * - the Invite reward credit (`recordInviteeJoin` — slots, expiry and "once per member, ever"),
 * - the join history behind `/invites` and `/info` (`InviteJoin`),
 * - the announcement in the configured channel.
 *
 * A rejoin within `fakeWindowDays` of the member's last real join is recorded as fake, so it shows
 * on `/info` but is never credited to anyone. Leaves are announced in the same channel.
 *
 * Also answers bare `info @user` / `invites @user` in the ticket bot's `ticket-…` channels.
 *
 * The first two always run, even while the feature is disabled, so the counts and the reward bonus
 * are right the moment it is turned on; only the announcement honours the feature toggle.
 *
 * Since the internal-API refactor the Gateway only *detects*: which invite was used (it holds the
 * invite cache). The rest — fake check, reward credit, history, announcement — runs in the worker
 * from the `invites` queue (`submit-invite-event.ts`), or inline when Redis isn't configured.
 *
 * Attribution: on each join the guild's invites are refetched and diffed against the last snapshot
 * (`detectUsedInvite`) — the one invite whose use count went up, the vanity URL included. Joins and
 * leaves are processed one at a time per guild, so two simultaneous joins cannot both claim the
 * same use and a quick leave-and-rejoin is applied in the order it happened.
 */

const CTX = "main/invites";
const enqueue = createGuildQueue();

async function seed(guild: Guild): Promise<void> {
    const uses = await fetchInviteUses(guild);
    if (uses) setInviteUses(guild.id, uses);
}

function report(err: unknown, what: string): void {
    handleError(new BotError(`Failed to ${what}: ${err}`, "EVENT"), CTX);
}

export default [
    {
        name: Events.ClientReady,
        once: true,
        execute: async client => {
            await Promise.allSettled(client.guilds.cache.map(guild => enqueue(guild.id, () => seed(guild))));
        },
    } satisfies EventConfig<Events.ClientReady>,

    {
        name: Events.GuildCreate,
        execute: guild => enqueue(guild.id, () => seed(guild)).catch(err => report(err, "seed invite uses")),
    } satisfies EventConfig<Events.GuildCreate>,

    {
        name: Events.GuildDelete,
        execute: guild => forgetInviteUses(guild.id),
    } satisfies EventConfig<Events.GuildDelete>,

    {
        name: Events.GuildMemberAdd,
        execute: member => {
            if (member.user.bot) return;
            const guildId = member.guild.id;

            return enqueue(guildId, async () => {
                const before = getInviteUses(guildId);
                const after = await fetchInviteUses(member.guild);
                if (after) setInviteUses(guildId, after);

                const used = before && after ? detectUsedInvite(before, after) : null;
                const joinedAt = member.joinedAt ?? new Date();

                Logger.debug(`Join ${member.id} in ${guildId}: ${used ? `${used.code} by ${used.inviterId}` : "unattributed"}`, CTX);
                await submitInviteJoin(member.guild, member.id, used, joinedAt);
            }).catch(err => report(err, "record an invite join"));
        },
    } satisfies EventConfig<Events.GuildMemberAdd>,

    {
        name: Events.GuildMemberRemove,
        execute: member => {
            if (member.user?.bot) return;
            const guildId = member.guild.id;
            const at = new Date();

            return enqueue(guildId, async () => {
                await submitInviteLeave(member.guild, member.id, member.user?.username ?? member.id, at);
            }).catch(err => report(err, "record an invitee leaving"));
        },
    } satisfies EventConfig<Events.GuildMemberRemove>,

    {
        name: Events.ChannelCreate,
        execute: async channel => {
            if (channel.type !== ChannelType.GuildText || !hasTicketName(channel.name)) return;

            // The audit entry can land a moment after the channel does.
            for (let attempt = 0; attempt < 3; attempt++) {
                if (await createdByTicketBot(channel.guild, channel.id)) return rememberTicketChannel(channel.id);
                await Bun.sleep(1_500);
            }
        },
    } satisfies EventConfig<Events.ChannelCreate>,

    {
        name: Events.ChannelDelete,
        execute: channel => {
            if (!channel.isDMBased()) forgetTicketChannel(channel.id);
        },
    } satisfies EventConfig<Events.ChannelDelete>,

    {
        name: Events.MessageCreate,
        execute: async message => {
            if (!message.inGuild()) return;

            // The ticket bot posting in a `ticket-…` channel proves it owns it — no audit log needed.
            if (message.author.id === INVITES_CONFIG.ticketBotId) {
                if ("name" in message.channel && hasTicketName(message.channel.name)) rememberTicketChannel(message.channel.id);
                return;
            }
            if (message.author.bot) return;

            const query = parseTicketQuery(message.content);
            if (query) await answerTicketQuery(message, query).catch(err => report(err, "answer a ticket invites query"));
        },
    } satisfies EventConfig<Events.MessageCreate>,
];
