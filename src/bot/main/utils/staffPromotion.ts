import type { Guild, GuildMember } from "discord.js";
import { StaffTierRepository, StaffRepository } from "@database/repositories";

export type MoveResult =
    | { ok: true; previousTierName: string; previousScore: number; newTierName: string; newScore: number }
    | { ok: false; reason: "no-ladder" | "at-top" | "at-bottom" };

/** Matches the same bands access.ts already checks (isStaff/isAnyManager/isAnyLead/isOwner). */
export function categoryLabel(score: number): string {
    if (score >= 100) return "Owner";
    if (score >= 90) return "Lead";
    if (score >= 80) return "High Staff";
    return "Staff";
}

/**
 * Moves a staff member one rung up/down their department's StaffTier ladder (ordered by score),
 * swapping the Discord roles bound to each rung and updating their StaffMember.position.
 */
export async function moveStaffTier(
    guild: Guild,
    targetMember: GuildMember,
    department: string,
    direction: "up" | "down",
): Promise<MoveResult> {
    const tiers = await StaffTierRepository.list(guild.id);
    const ladder = tiers
        .filter(t => t.department?.toLowerCase() === department.toLowerCase())
        .sort((a, b) => a.score - b.score);

    if (!ladder.length) return { ok: false, reason: "no-ladder" };

    let currentIndex = -1;
    for (let i = ladder.length - 1; i >= 0; i--) {
        if (ladder[i].roleIds.some(id => targetMember.roles.cache.has(id))) {
            currentIndex = i;
            break;
        }
    }

    const newIndex = direction === "up" ? currentIndex + 1 : currentIndex - 1;
    if (direction === "down" && currentIndex < 0) return { ok: false, reason: "at-bottom" };
    if (newIndex < 0) return { ok: false, reason: "at-bottom" };
    if (newIndex >= ladder.length) return { ok: false, reason: "at-top" };

    const previousTier = currentIndex >= 0 ? ladder[currentIndex] : null;
    const newTier = ladder[newIndex];

    for (const tier of ladder) {
        for (const roleId of tier.roleIds) {
            if (targetMember.roles.cache.has(roleId)) {
                await targetMember.roles.remove(roleId).catch(() => null);
            }
        }
    }
    for (const roleId of newTier.roleIds) {
        await targetMember.roles.add(roleId).catch(() => null);
    }

    await StaffRepository.updatePosition(targetMember.id, newTier.name, department);

    return {
        ok: true,
        previousTierName: previousTier?.name ?? "—",
        previousScore: previousTier?.score ?? 0,
        newTierName: newTier.name,
        newScore: newTier.score,
    };
}
