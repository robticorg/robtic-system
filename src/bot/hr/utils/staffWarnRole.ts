import type { Guild, GuildMember } from "discord.js";
import { Logger } from "@core/libs";

const CTX = "hr:staff-warn-role";
const WARN_ROLE_NAME_PATTERN = /^Warn \d+$/;

function warnRoleName(level: number): string {
    return `Warn ${level}`;
}

/** Found-by-name first, same convention as streakRole.ts's ensureStreakRole — never recreated if one already exists under that name. */
async function ensureWarnRole(guild: Guild, level: number) {
    const name = warnRoleName(level);
    const existing = guild.roles.cache.find((role) => role.name === name);
    if (existing) return existing;

    return guild.roles.create({ name, reason: "Auto-created staff warn-level role" }).catch((err) => {
        Logger.warn(`Could not create warn role "${name}" in ${guild.id}: ${err}`, CTX);
        return null;
    });
}

/** Swaps a staff member's `Warn N` role to match their current warning count — removes any other Warn role first. */
export async function syncStaffWarnRole(member: GuildMember, warningCount: number): Promise<void> {
    const existingWarnRoles = member.roles.cache.filter((role) => WARN_ROLE_NAME_PATTERN.test(role.name));
    for (const [, role] of existingWarnRoles) {
        await member.roles.remove(role).catch((err) => {
            Logger.warn(`Could not remove warn role "${role.name}" from ${member.id} in ${member.guild.id}: ${err}`, CTX);
        });
    }

    if (warningCount <= 0) return;

    const role = await ensureWarnRole(member.guild, warningCount);
    if (!role) return;

    await member.roles.add(role).catch((err) => {
        Logger.warn(`Could not add warn role "${role.name}" to ${member.id} in ${member.guild.id}: ${err}`, CTX);
    });
}
