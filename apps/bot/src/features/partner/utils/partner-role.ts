import type { Guild, Role } from "discord.js";
import { PartnerServerRepository, ServerConfigRepository } from "@database/repositories";
import { Logger } from "@logger";

export type PartnerRoleResult =
    | "granted"
    | "removed"
    /** They still represent another partner here, so the role stays. */
    | "kept"
    /** Not in this server (yet) — they get it when they join. */
    | "not-member"
    | "no-role"
    | "failed";

/** Why the bot can't hand `role` out, or `null` when it can. */
export function partnerRoleProblem(role: Role): string | null {
    if (role.id === role.guild.id) return "`@everyone` can't be the partner role.";
    if (role.managed) return `${role} is managed by an integration — pick a normal role.`;
    if (!role.editable) return `I can't give ${role} — it must be below my highest role, and I need **Manage Roles**.`;
    return null;
}

async function resolveRole(guild: Guild): Promise<Role | null> {
    const roleId = await ServerConfigRepository.getPartnerRole(guild.id);
    if (!roleId) return null;
    return guild.roles.cache.get(roleId) ?? await guild.roles.fetch(roleId).catch(() => null);
}

/** Gives the partner role to a representative, if one is set and they are in the server. */
export async function grantPartnerRole(guild: Guild, userId: string): Promise<PartnerRoleResult> {
    const role = await resolveRole(guild);
    if (!role) return "no-role";

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return "not-member";
    if (member.roles.cache.has(role.id)) return "granted";

    return member.roles.add(role, "Partner representative").then(
        () => "granted" as const,
        err => {
            Logger.warn(`Could not give the partner role to ${userId} in ${guild.id}: ${err}`, "partner");
            return "failed" as const;
        },
    );
}

/**
 * Takes the partner role back — but only once they represent no partner here at all. Call after
 * the partner row is deleted, so it is no longer counted.
 */
export async function revokePartnerRole(guild: Guild, userId: string): Promise<PartnerRoleResult> {
    if (await PartnerServerRepository.countByRepresentative(guild.id, userId) > 0) return "kept";

    const role = await resolveRole(guild);
    if (!role) return "no-role";

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return "not-member";
    if (!member.roles.cache.has(role.id)) return "removed";

    return member.roles.remove(role, "No longer a partner representative").then(
        () => "removed" as const,
        err => {
            Logger.warn(`Could not remove the partner role from ${userId} in ${guild.id}: ${err}`, "partner");
            return "failed" as const;
        },
    );
}
