import { escapeMarkdown } from "discord.js";
import { BP_SCALE } from "@constants";

/**
 * Every piece of invites text, pure so the exact wording is testable. The mention stays a mention
 * (it renders as the member's name); an inviter's username is escaped, since `_` or `*` in a name
 * would otherwise turn the bold into something else.
 */

/** Invites a member still has credit for: everyone they brought in, minus those who left. */
export function inviteTotal(counts: { joins: number; leaves: number }): number {
    return Math.max(0, counts.joins - counts.leaves);
}

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

/** How many pages `total` rows fill, never fewer than one (an empty list is still one page). */
export function pageCount(total: number, pageSize: number): number {
    return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/** Keeps a requested page inside `[0, pageCount - 1]`. */
export function clampPage(page: number, total: number, pageSize: number): number {
    if (!Number.isFinite(page)) return 0;
    return Math.min(Math.max(0, Math.floor(page)), pageCount(total, pageSize) - 1);
}
