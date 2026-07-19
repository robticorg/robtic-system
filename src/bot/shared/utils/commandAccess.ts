import type { GuildMember } from "discord.js";
import { CommandAccessRepository, StaffTierRepository } from "@database/repositories";

/**
 * Checks the per-guild, per-command role/category grants configured via /command-access.
 * This is an additional way in — callers should still fall through to the command's normal
 * requiredPermission/department check when this returns false.
 */
export async function hasCommandAccessGrant(guildId: string, commandName: string, member: GuildMember): Promise<boolean> {
    const entry = await CommandAccessRepository.getForCommand(guildId, commandName);
    if (!entry) return false;

    if (entry.allowedRoleIds.some(id => member.roles.cache.has(id))) return true;

    if (entry.allowedCategoryKeys.length) {
        const tiers = await StaffTierRepository.getCached(guildId);
        for (const tier of tiers) {
            if (!entry.allowedCategoryKeys.includes(tier.key)) continue;
            if (tier.roleIds.some(id => member.roles.cache.has(id))) return true;
        }
    }

    return false;
}
