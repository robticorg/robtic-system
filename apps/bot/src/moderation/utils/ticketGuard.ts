import { MessageFlags, type ChatInputCommandInteraction, type GuildMember } from "discord.js";
import { TicketRepository } from "@database/repositories";
import type { ITicket } from "@database/models/Ticket";
import { hasFullPower } from "@shared/utils/access";
import { TICKET_CATEGORIES, type TicketCategory } from "../config/ticket";

export function findCategory(categoryId: string): TicketCategory | undefined {
    return TICKET_CATEGORIES.find(c => c.id === categoryId);
}

export function isTicketStaff(member: GuildMember, category: TicketCategory): boolean {
    return (
        hasFullPower(member) ||
        member.roles.cache.has(category.supportRoleId) ||
        member.roles.cache.has(category.adminRoleId)
    );
}

/** Resolves the interaction's channel to its open ticket + category, replying with an error and returning null if it isn't one. */
export async function requireOpenTicket(
    interaction: ChatInputCommandInteraction
): Promise<{ ticket: ITicket; category: TicketCategory } | null> {
    const ticket = await TicketRepository.findByChannel(interaction.channelId);
    if (!ticket || ticket.status === "closed") {
        await interaction.reply({
            content: "This command can only be used inside an open ticket channel.",
            flags: MessageFlags.Ephemeral,
        });
        return null;
    }

    const category = findCategory(ticket.category);
    if (!category) {
        await interaction.reply({
            content: "This ticket's category is no longer configured — ask an admin to check `config/ticket.ts`.",
            flags: MessageFlags.Ephemeral,
        });
        return null;
    }

    return { ticket, category };
}

/** Replies with a permission error and returns false when the member isn't staff for the ticket's category. */
export async function requireTicketStaff(
    interaction: ChatInputCommandInteraction,
    category: TicketCategory
): Promise<boolean> {
    const member = interaction.member as GuildMember;
    if (isTicketStaff(member, category)) return true;

    await interaction.reply({
        content: "Only support staff for this ticket's category can use this command.",
        flags: MessageFlags.Ephemeral,
    });
    return false;
}
