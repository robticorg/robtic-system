import { escapeMarkdown } from "discord.js";
import { BP_SCALE } from "@constants";

import { L } from "@utils";
/** Moved to the invite domain (`@core/invites`); re-exported for existing callers. */
export { fakeWindowStart, inviteTotal } from "@core/invites";

/**
 * Every piece of invites text, pure so the exact wording is testable. The mention stays a mention
 * (it renders as the member's name); an inviter's username is escaped, since `_` or `*` in a name
 * would otherwise turn the bold into something else.
 */


/** Arabic words for the English ones `plural` is called with. */
const AR_WORDS: Record<string, string> = { invite: "دعوة", join: "دخول" };

export function plural(count: number, word: string): string {
    return L(`${count} ${word}${count === 1 ? "" : "s"}`, `${count} ${AR_WORDS[word] ?? word}`);
}

/** Basis points → "4%" / "2.5%". */
export function formatBonusPercent(bp: number): string {
    const percent = Math.max(0, bp) / (BP_SCALE / 100);
    return `${Number.isInteger(percent) ? percent : percent.toFixed(2).replace(/0+$/, "")}%`;
}

export function vanityJoinMessage(memberId: string, vanityCode: string): string {
    return L(`**<@${memberId}>** has arrived by using the vanity invite **${escapeMarkdown(vanityCode)}**.`, `**<@${memberId}>** دخل برابط السيرفر الخاص **${escapeMarkdown(vanityCode)}**.`);
}

export function invitedJoinMessage(memberId: string, inviterName: string, inviterTotal: number): string {
    return L(`**<@${memberId}>** just joined. They were invited by **${escapeMarkdown(inviterName)}**, who now has **${plural(inviterTotal, "invite")}!**`, `**<@${memberId}>** دخل للتو. دعاه **${escapeMarkdown(inviterName)}** وصار عنده **${plural(inviterTotal, "invite")}!**`);
}

export function unknownJoinMessage(memberId: string): string {
    return L(`**<@${memberId}>** just joined, but I couldn't tell which invite they used.`, `**<@${memberId}>** دخل للتو، بس ما عرفت أي دعوة استخدم.`);
}


export function invitedLeaveMessage(memberName: string, inviterName: string): string {
    return L(`**${escapeMarkdown(memberName)}** has left. They were invited by **${escapeMarkdown(inviterName)}**.`, `**${escapeMarkdown(memberName)}** طلع. كان دعاه **${escapeMarkdown(inviterName)}**.`);
}

export function vanityLeaveMessage(memberName: string): string {
    return L(`**${escapeMarkdown(memberName)}** has left. They were invited using a vanity invite.`, `**${escapeMarkdown(memberName)}** طلع. كان داخل برابط السيرفر الخاص.`);
}

export function unknownLeaveMessage(memberName: string): string {
    return L(`**${escapeMarkdown(memberName)}** has left, but I don't know who invited them.`, `**${escapeMarkdown(memberName)}** طلع، بس ما أعرف مين دعاه.`);
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
