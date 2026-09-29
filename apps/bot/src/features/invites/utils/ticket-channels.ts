import { AuditLogEvent, PermissionFlagsBits, type Guild } from "discord.js";
import { INVITES_CONFIG } from "@constants";

/**
 * Ticket channels where a bare `info @user` / `invites @user` is answered: named `ticket-…` and
 * created by the ticket bot. Verdicts are cached in memory both ways, so each channel costs at most
 * one audit-log read. After a restart the cache refills lazily — the first lookup in a channel asks
 * the audit log again (Discord keeps it for 45 days), or the ticket bot posting there proves it.
 */
const tickets = new Set<string>();
const notTickets = new Set<string>();

export function hasTicketName(name: string | null | undefined): boolean {
    return Boolean(name?.toLowerCase().startsWith(INVITES_CONFIG.ticketChannelPrefix));
}

export function rememberTicketChannel(channelId: string): void {
    tickets.add(channelId);
    notTickets.delete(channelId);
}

export function forgetTicketChannel(channelId: string): void {
    tickets.delete(channelId);
    notTickets.delete(channelId);
}

/** Whether the ticket bot created `channelId`, per the audit log. Needs View Audit Log; `false` without it. */
export async function createdByTicketBot(guild: Guild, channelId: string): Promise<boolean> {
    if (!guild.members.me?.permissions.has(PermissionFlagsBits.ViewAuditLog)) return false;

    const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.ChannelCreate, limit: 50 }).catch(() => null);
    const entry = logs?.entries.find(e => e.targetId === channelId);
    return entry?.executorId === INVITES_CONFIG.ticketBotId;
}

export async function isTicketChannel(guild: Guild, channelId: string, name: string | null | undefined): Promise<boolean> {
    if (tickets.has(channelId)) return true;
    if (notTickets.has(channelId) || !hasTicketName(name)) return false;

    const verdict = await createdByTicketBot(guild, channelId);
    (verdict ? tickets : notTickets).add(channelId);
    return verdict;
}
