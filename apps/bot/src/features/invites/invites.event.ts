import { Events, type Guild } from "discord.js";
import type { EventConfig } from "@typings/event";
import { handleError, BotError } from "@core/handlers";
import { Logger } from "@logger";
import { detectUsedInvite, recordInviteeJoin, recordInviteeLeave } from "@core/rewards";
import { InviteJoinRepository } from "@database/repositories";
import { createGuildQueue } from "@bot/utils/guild-queue";
import { fetchInviteUses, getInviteUses, setInviteUses, forgetInviteUses } from "./utils/invite-use-cache";
import { announceJoin } from "./functions/announce-join";

/**
 * The one place invites are tracked. Each join is attributed once, then feeds three things:
 *
 * - the Invite reward credit (`recordInviteeJoin` — slots, expiry and "once per member, ever"),
 * - the join history behind `/invites` and `/info` (`InviteJoin`),
 * - the announcement in the configured channel.
 *
 * The first two always run, even while the feature is disabled, so the counts and the reward bonus
 * are right the moment it is turned on; only the announcement honours the feature toggle.
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

                const decision = await recordInviteeJoin(guildId, member.id, used?.vanity ? null : used, joinedAt);
                const recorded = await InviteJoinRepository.record({
                    guildId,
                    inviteeId: member.id,
                    inviterId: used?.inviterId ?? null,
                    inviteCode: used?.code ?? null,
                    source: used?.vanity ? "vanity" : used?.inviterId ? "invite" : "unknown",
                    joinedAt,
                });

                Logger.debug(`Join ${member.id} in ${guildId}: ${used ? `${used.code} by ${used.inviterId}` : "unattributed"}, reward credit ${decision}`, CTX);

                // A replayed join event is already recorded and already announced.
                if (recorded) await announceJoin(member, used);
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
                await Promise.all([
                    recordInviteeLeave(guildId, member.id, at),
                    InviteJoinRepository.markLeft(guildId, member.id, at),
                ]);
            }).catch(err => report(err, "record an invitee leaving"));
        },
    } satisfies EventConfig<Events.GuildMemberRemove>,
];
