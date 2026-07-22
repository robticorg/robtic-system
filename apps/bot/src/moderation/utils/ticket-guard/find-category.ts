import { TICKET_CATEGORIES, type TicketCategory } from "../../config/ticket";

export function findCategory(categoryId: string): TicketCategory | undefined {
    return TICKET_CATEGORIES.find(c => c.id === categoryId);
}
