import type { GuildMember } from "discord.js";
import { hasFullPower } from "@shared/utils/access";
import type { TicketCategory } from "../../config/ticket";

export function isTicketStaff(member: GuildMember, category: TicketCategory): boolean {
    return (
        hasFullPower(member) ||
        member.roles.cache.has(category.supportRoleId) ||
        member.roles.cache.has(category.adminRoleId)
    );
}
