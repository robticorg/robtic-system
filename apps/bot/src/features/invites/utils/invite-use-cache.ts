import { PermissionFlagsBits, type Guild } from "discord.js";
import type { InviteUseSnapshot } from "@core/rewards";

/**
 * The last-seen use count of every invite in each guild — the "before" half of the diff that tells
 * which invite a new member used (Discord's join event does not say). In memory only: after a
 * restart it is reseeded on `clientReady`, and until a guild is seeded its joins are simply not
 * attributed rather than guessed.
 *
 * Refreshed from `guild.invites.fetch()` on every join, so it needs no `GuildInvites` intent: an
 * invite created since the last fetch is absent from "before" and counts from zero uses. The vanity
 * URL is not in that list, so its counter is read separately and stored alongside, flagged.
 */
const snapshots = new Map<string, Map<string, InviteUseSnapshot>>();

/** The guild's current invites (vanity included), or `null` if the bot cannot read them (needs Manage Server). */
export async function fetchInviteUses(guild: Guild): Promise<Map<string, InviteUseSnapshot> | null> {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild)) return null;

    const invites = await guild.invites.fetch({ cache: false }).catch(() => null);
    if (!invites) return null;

    const uses = new Map<string, InviteUseSnapshot>(invites.map(invite => [invite.code, {
        code: invite.code,
        uses: invite.uses ?? 0,
        maxUses: invite.maxUses ?? 0,
        inviterId: invite.inviter?.bot ? null : (invite.inviterId ?? null),
    }]));

    if (guild.vanityURLCode) {
        const vanity = await guild.fetchVanityData().catch(() => null);
        if (vanity?.code) uses.set(vanity.code, { code: vanity.code, uses: vanity.uses, maxUses: 0, inviterId: null, vanity: true });
    }

    return uses;
}

export function getInviteUses(guildId: string): Map<string, InviteUseSnapshot> | undefined {
    return snapshots.get(guildId);
}

export function setInviteUses(guildId: string, uses: Map<string, InviteUseSnapshot>): void {
    snapshots.set(guildId, uses);
}

export function forgetInviteUses(guildId: string): void {
    snapshots.delete(guildId);
}
