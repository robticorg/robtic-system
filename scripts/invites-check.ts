/** Verifies the invites feature's wording, totals and `/info` paging — no database, no gateway. */
import {
    inviteTotal,
    plural,
    formatBonusPercent,
    vanityJoinMessage,
    invitedJoinMessage,
    unknownJoinMessage,
    pageCount,
    clampPage,
    invitedLeaveMessage,
    vanityLeaveMessage,
    unknownLeaveMessage,
    fakeWindowStart,
    parseTicketQuery,
} from "@bot/features/invites/utils/invite-format";
import { hasTicketName } from "@bot/features/invites/utils/ticket-channels";
import { INFO_PAGE_ID } from "@bot/features/invites/utils/info-view";
import { invitesFeature } from "@bot/features/invites/invites";
import { detectUsedInvite, inviteBonusBp, type InviteUseSnapshot } from "@core/rewards";
import { INVITES_CONFIG } from "@constants";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

// Join announcements — the exact wording asked for.
{
    const vanity = vanityJoinMessage("1508501667920875634", "robtic");
    check("vanity join message", vanity === "**<@1508501667920875634>** has arrived by using the vanity invite **robtic**.", vanity);

    const invited = invitedJoinMessage("1440413794198360136", ".30g", 7);
    check("invited join message", invited === "**<@1440413794198360136>** just joined. They were invited by **.30g** who now has **7 invites !**", invited);

    check("invited join message: singular", invitedJoinMessage("1", "a", 1).endsWith("**1 invite !**"));
    check("inviter names are escaped so the bold survives", invitedJoinMessage("1", "under_score*", 2).includes("**under\\_score\\***"));
    check("unknown join still mentions the member", unknownJoinMessage("42").startsWith("**<@42>** just joined"));
}

// Totals and the bonus line.
{
    check("total is joins minus leaves", inviteTotal({ joins: 12, leaves: 3 }) === 9);
    check("total never goes negative", inviteTotal({ joins: 1, leaves: 4 }) === 0);
    check("plural", plural(0, "invite") === "0 invites" && plural(1, "invite") === "1 invite" && plural(2, "invite") === "2 invites");
    check("bonus: 4 active credits shows 4%", formatBonusPercent(inviteBonusBp(4)) === "4%", formatBonusPercent(inviteBonusBp(4)));
    check("bonus: capped at 10%", formatBonusPercent(inviteBonusBp(25)) === "10%");
    check("bonus: none shows 0%", formatBonusPercent(0) === "0%");
    check("bonus: fractional basis points keep their decimals", formatBonusPercent(250) === "2.5%" && formatBonusPercent(125) === "1.25%");
    check("'this week' is the same 7-day window as an invite credit", INVITES_CONFIG.recentWindowDays === 7);
}

// `/info` paging: 10 per page.
{
    const size = INVITES_CONFIG.infoPageSize;
    check("page size is 10", size === 10);
    check("no invites is still one page", pageCount(0, size) === 1);
    check("10 invites is one page", pageCount(10, size) === 1);
    check("11 invites is two pages", pageCount(11, size) === 2);
    check("25 invites is three pages", pageCount(25, size) === 3);
    check("page clamps below zero", clampPage(-1, 25, size) === 0);
    check("page clamps past the end", clampPage(9, 25, size) === 2);
    check("garbage page falls back to the first", clampPage(Number.NaN, 25, size) === 0);

    check("button id matches the handler", INFO_PAGE_ID.test("invites:info:111:222:3:next") && INFO_PAGE_ID.test("invites:info:111:222:0:prev"));
    check("foreign ids do not match", !INFO_PAGE_ID.test("top:nav:1:xp:0:daily") && !INFO_PAGE_ID.test("invites:info:1:2:x:next"));
}

// Vanity joins are detected like any invite, and never carry an inviter.
{
    const vanity: InviteUseSnapshot = { code: "robtic", uses: 40, maxUses: 0, inviterId: null, vanity: true };
    const regular: InviteUseSnapshot = { code: "abc", uses: 3, maxUses: 0, inviterId: "A" };
    const used = detectUsedInvite(
        new Map([[vanity.code, vanity], [regular.code, regular]]),
        new Map([[vanity.code, { ...vanity, uses: 41 }], [regular.code, regular]]),
    );
    check("a vanity join is detected as the vanity invite", used?.vanity === true && used.code === "robtic");
    check("a vanity join has no inviter to credit", used?.inviterId === null);
}

// Manifest.
{
    const names: string[] = invitesFeature.commands.map(c => c.name);
    check("commands: /invites, /info, /invites-config", ["invites", "info", "invites-config"].every(n => names.includes(n)));
    check("/invites-config is admin-only", invitesFeature.commands.find(c => c.name === "invites-config")?.access === "admin");
}

// Leave announcements — the exact wording asked for.
{
    const invited = invitedLeaveMessage("raouf._.159", "robo._.38");
    check("invited leave message", invited === "**raouf.\\_.159** has left. They were invited by **robo.\\_.38**.", invited);

    const vanity = vanityLeaveMessage("raouf._.159");
    check("vanity leave message", vanity === "**raouf.\\_.159** has left. They were invited using a vanity invite.", vanity);

    const unknown = unknownLeaveMessage("c_iot");
    check("unknown leave message", unknown === "**c\\_iot** has left but I haven't registered who invited them.", unknown);
}

// Fake window: a rejoin within 30 days of the last real join is fake.
{
    const now = new Date("2026-09-28T12:00:00Z");
    const start = fakeWindowStart(now);
    check("fake window is 30 days", now.getTime() - start.getTime() === 30 * 86_400_000);
    check("a real join 29 days ago is inside the window", new Date(now.getTime() - 29 * 86_400_000) >= start);
    check("a real join 31 days ago is outside it", new Date(now.getTime() - 31 * 86_400_000) < start);
}

// Bare ticket-channel queries.
{
    const id = "1440413794198360136";
    check("info @user", JSON.stringify(parseTicketQuery(`info <@${id}>`)) === JSON.stringify({ kind: "info", userId: id }));
    check("invites @user (nickname mention)", parseTicketQuery(`invites <@!${id}>`)?.userId === id);
    check("invites <id>", parseTicketQuery(`Invites ${id}`)?.kind === "invites");
    check("bare info means yourself", parseTicketQuery("info")?.userId === null);
    check("chatter is not a query", parseTicketQuery("info about the server please") === null && parseTicketQuery("my invites") === null);
    check("a prefixed command is not a bare query", parseTicketQuery(`!info <@${id}>`) === null);
    check("ticket channels are recognised by name", hasTicketName("ticket-0042") && hasTicketName("Ticket-x") && !hasTicketName("tickets") && !hasTicketName(null));
}

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}

console.log("\nAll invites checks passed.");
