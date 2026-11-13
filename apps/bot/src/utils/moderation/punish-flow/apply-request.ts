import type { EmbedBuilder, Guild } from "discord.js";
import type { BotClient } from "@core/bot-client";
import type { PunishType } from "@typings/punishment";
import { ReasonRepository } from "@database/repositories";
import { executeWarn } from "@bot/commands/guild/admin/moderation/warn.command";
import { executeMute, MUTE_MAX_HOURS } from "@bot/commands/guild/admin/moderation/mute.command";
import { executeBan, JAIL_MAX_DAYS } from "@bot/commands/guild/admin/moderation/jail.command";

export interface PunishmentToApply {
    type: PunishType;
    targetId: string;
    reasonKey: string;
    /** Who the punishment is recorded under (the moderator who asked for it). */
    moderatorId: string;
    /** Mute hours, jail days or "perm". */
    extra: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Applies a saved or approved punishment: reason looked up, length kept inside Discord's limits. */
export async function applyPunishment(client: BotClient, guild: Guild, p: PunishmentToApply): Promise<EmbedBuilder> {
    const reasonDoc = await ReasonRepository.findByKey(p.reasonKey, guild.id);
    const reason = reasonDoc?.label ?? p.reasonKey;
    const reasonAr = reasonDoc?.labelAr ?? reason;
    const member = guild.members.cache.get(p.targetId) ?? await guild.members.fetch(p.targetId).catch(() => null);
    const username = (await client.users.fetch(p.targetId).catch(() => null))?.username ?? p.targetId;

    if (p.type === "warn") return (await executeWarn(client, guild.id, p.targetId, username, reason, reasonAr, p.moderatorId, member)).embed;
    if (p.type === "mute") {
        const hours = clamp(parseInt(p.extra, 10) || 24, 1, MUTE_MAX_HOURS);
        return (await executeMute(client, guild.id, p.targetId, username, reason, reasonAr, p.moderatorId, member, hours * 3_600_000)).embed;
    }
    const permanent = p.extra === "perm";
    const days = permanent ? 0 : clamp(parseInt(p.extra, 10) || 7, 1, JAIL_MAX_DAYS);
    return (await executeBan(client, guild.id, p.targetId, username, reason, reasonAr, p.moderatorId, member, permanent, days, guild)).embed;
}
