import { GuildMember } from "discord.js";
import { STAFF_TEAM_ROLE_ID, FULL_POWER_ROLE_IDS } from "@core/config";
import { StaffTierRepository } from "@database/repositories";

/**
 * Per-guild staff tiers/departments (see StaffTier model) replaced the old global
 * ROLE_MAP/PERMISSION_HIERARCHY/DEPARTMENT_ROLES — every check below now reads a
 * per-guild, cached tier list instead of a hardcoded constant, hence the `async`.
 * Manager/Lead bands (score >= 80 / >= 90) mirror the same thresholds this file
 * already used for isAnyManager/isAnyLead — a guild configuring its own tiers should
 * follow the same convention for isManagerOf/isLeadOf to mean anything for it.
 */

export function hasFullPower(member: GuildMember): boolean {
    return FULL_POWER_ROLE_IDS.some(id => member.roles.cache.has(id));
}

function matchesTier(member: GuildMember, roleIds: string[]): boolean {
    return roleIds.length > 0 && member.roles.cache.some(r => roleIds.includes(r.id));
}

export async function getMemberLevel(member: GuildMember): Promise<{ level: string; score: number }> {
    const tiers = await StaffTierRepository.getCached(member.guild.id);

    let best = "Member";
    let bestScore = 0;
    for (const tier of tiers) {
        if (tier.score <= bestScore) continue;
        if (matchesTier(member, tier.roleIds)) {
            best = tier.key;
            bestScore = tier.score;
        }
    }
    return { level: best, score: bestScore };
}

export async function isInDepartment(member: GuildMember, department: Department): Promise<boolean> {
    if (hasFullPower(member)) return true;
    const tiers = await StaffTierRepository.getCached(member.guild.id);
    return tiers.some(tier =>
        tier.department?.toLowerCase() === department.toLowerCase() && matchesTier(member, tier.roleIds)
    );
}

export async function getMemberDepartments(member: GuildMember): Promise<string[]> {
    const tiers = await StaffTierRepository.getCached(member.guild.id);
    const departments = new Set<string>();
    for (const tier of tiers) {
        if (tier.department && matchesTier(member, tier.roleIds)) departments.add(tier.department);
    }
    return [...departments];
}

export async function isManagerOf(member: GuildMember, department: Department): Promise<boolean> {
    if (hasFullPower(member)) return true;
    const tiers = await StaffTierRepository.getCached(member.guild.id);
    return tiers.some(tier =>
        tier.department?.toLowerCase() === department.toLowerCase() && tier.score >= 80 && matchesTier(member, tier.roleIds)
    );
}

export async function isLeadOf(member: GuildMember, department: Department): Promise<boolean> {
    if (hasFullPower(member)) return true;
    const tiers = await StaffTierRepository.getCached(member.guild.id);
    return tiers.some(tier =>
        tier.department?.toLowerCase() === department.toLowerCase() && tier.score >= 90 && matchesTier(member, tier.roleIds)
    );
}

export async function isOwner(member: GuildMember): Promise<boolean> {
    if (hasFullPower(member)) return true;
    const { score } = await getMemberLevel(member);
    return score >= 100;
}

export async function hasDepartmentAuthority(member: GuildMember, department: Department): Promise<boolean> {
    if (hasFullPower(member)) return true;
    return (await isOwner(member)) || (await isLeadOf(member, department)) || (await isManagerOf(member, department));
}

export async function isStaff(member: GuildMember): Promise<boolean> {
    if (hasFullPower(member)) return true;
    if (member.roles.cache.has(STAFF_TEAM_ROLE_ID)) return true;
    const { score } = await getMemberLevel(member);
    return score >= 20;
}

export async function isAnyManager(member: GuildMember): Promise<boolean> {
    if (hasFullPower(member)) return true;
    const { score } = await getMemberLevel(member);
    return score >= 80;
}

export async function isAnyLead(member: GuildMember): Promise<boolean> {
    if (hasFullPower(member)) return true;
    const { score } = await getMemberLevel(member);
    return score >= 90;
}

export async function isOwnerOrLead(member: GuildMember): Promise<boolean> {
    if (hasFullPower(member)) return true;
    const { score } = await getMemberLevel(member);
    return score >= 90;
}
