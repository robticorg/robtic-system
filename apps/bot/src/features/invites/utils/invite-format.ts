import { escapeMarkdown } from "discord.js";
import { BP_SCALE } from "@constants";

/** Moved to the invite domain (`@core/invites`); re-exported for existing callers. */
export { fakeWindowStart, inviteTotal } from "@core/invites";

/**
 * Every piece of invites text, pure so the exact wording is testable. The mention stays a mention
 * (it renders as the member's name); an inviter's username is escaped, since `_` or `*` in a name
 * would otherwise turn the bold into something else.
 */


export function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Basis points → "4%" / "2.5%". */
export function formatBonusPercent(bp: number): string {
    const percent = Math.max(0, bp) / (BP_SCALE / 100);
    return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, "")}%`;
}

export function vanityJoinMessage(memberId: string, vanityCode: string): string {
    return `**<@${memberId}>** has arrived by using the vanity invite **${escapeMarkdown(vanityCode)}**.`;
}

export function invitedJoinMessage(memberId: string, inviterName: string, inviterTotal: number): string {
    return `**<@${memberId}>** just joined. They were invited by **${escapeMarkdown(inviterName)}** who now has **${plural(inviterTotal, "invite")} !**`;
}

export function unknownJoinMessage(memberId: string): string {
    return `**<@${memberId}>** just joined, but I couldn't tell which invite they used.`;
}


export function invitedLeaveMessage(memberName: string, inviterName: string): string {
    return `**${escapeMarkdown(memberName)}** has left. They were invited by **${escapeMarkdown(inviterName)}**.`;
}

export function vanityLeaveMessage(memberName: string): string {
    return `**${escapeMarkdown(memberName)}** has left. They were invited using a vanity invite.`;
}

export function unknownLeaveMessage(memberName: string): string {
    return `**${escapeMarkdown(memberName)}** has left but I haven't registered who invited them.`;
}

export interface TicketQuery {
    kind: "info" | "invites";
    /** The mentioned or pasted user id; `null` means the author themselves. */
    userId: string | null;
}

const TICKET_QUERY = /^(info|invites)(?:\s+(?:<@!?(\d{17,20})>|(\d{17,20})))?\s*$/i;

/** `info @user` / `invites @user` / `invites 123…` / bare `info` — anything else is not a query. */
export function parseTicketQuery(content: string): TicketQuery | null {
    const match = TICKET_QUERY.exec(content.trim());
    if (!match) return null;
    return { kind: match[1]!.toLowerCase() as TicketQuery["kind"], userId: match[2] ?? match[3] ?? null };
}

/** How many pages `total` rows fill, never fewer than one (an empty list is still one page). */
export function pageCount(total: number, pageSize: number): number {
    return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/** Keeps a requested page inside `[0, pageCount - 1]`. */
export function clampPage(page: number, total: number, pageSize: number): number {
    if (!Number.isFinite(page)) return 0;
    return Math.min(Math.max(0, Math.floor(page)), pageCount(total, pageSize) - 1);
}
