/** Verifies the `roles` panel: line format, classification, filters, sorting, paging and the staff API client — no gateway. */
import { ComponentType } from "discord.js";
import {
    applyRoleFilter,
    classifyRole,
    clampPage,
    describeFilter,
    pageCount,
    pageLines,
    parseOptionalCount,
    roleLine,
    ROLES_PAGE_SIZE,
    type RoleRow,
} from "@bot/utils/roles-view/roles-view";
import { ROLES_BUTTON_ID, ROLES_FILTER_MODAL_ID, ROLES_SEARCH_MODAL_ID, buildRolesFilterModal, buildRolesSearchModal } from "@bot/utils/roles-view/roles-panel";
import { getStaffRoles } from "@bot/services/staff-api";

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
};

const row = (over: Partial<RoleRow>): RoleRow => ({ id: "1", name: "Role", position: 1, members: 0, kind: "member", order: null, ...over });

// Line format: N. <@&id> | type | #order | members — order only for staff.
{
    check("staff line has its order", roleLine(row({ id: "42", kind: "high", order: 5, members: 12 }), 0) === "**1.** <@&42> | ⭐ High staff | #5 | 12 members", roleLine(row({ id: "42", kind: "high", order: 5, members: 12 }), 0));
    check("non-staff line skips the order", roleLine(row({ id: "7", kind: "member", members: 1 }), 2) === "**3.** <@&7> | 👤 Member | 1 member");
}

// Classification.
{
    const staff = { roleId: "1", isStaffRole: true, order: 9, type: "owner" as const };
    check("staff API type wins", JSON.stringify(classifyRole({ id: "1", managed: false, isBoosterRole: false }, staff)) === JSON.stringify({ kind: "owner", order: 9 }));
    check("non-staff from the API falls back to Discord", classifyRole({ id: "1", managed: false, isBoosterRole: false }, { roleId: "1", isStaffRole: false, order: null, type: null }).kind === "member");
    check("booster role", classifyRole({ id: "1", managed: true, isBoosterRole: true }, undefined).kind === "booster");
    check("bot/integration role", classifyRole({ id: "1", managed: true, isBoosterRole: false }, undefined).kind === "bot");
}

// Filters and sorting.
{
    const rows = [
        row({ id: "1", name: "Owner", position: 50, kind: "owner", order: 10, members: 1 }),
        row({ id: "2", name: "Admin", position: 40, kind: "high", order: 8, members: 3 }),
        row({ id: "3", name: "Helper", position: 30, kind: "staff", order: 2, members: 20 }),
        row({ id: "4", name: "Server Booster", position: 20, kind: "booster", members: 8 }),
        row({ id: "5", name: "Members", position: 10, kind: "member", members: 500 }),
    ];
    const ids = (f: Parameters<typeof applyRoleFilter>[1]) => applyRoleFilter(rows, f).map(r => r.id).join();

    check("no filter: highest position first", ids({}) === "1,2,3,4,5");
    check("search by name (case-insensitive)", ids({ query: "HELP" }) === "3");
    check("search by exact id", ids({ query: "4" }) === "4");
    check("type filter", ids({ kinds: ["high", "booster"] }) === "2,4");
    check("any staff", ids({ kinds: ["anyStaff"] }) === "1,2,3");
    check("order range only keeps staff in range", ids({ orderMin: 3, orderMax: 9 }) === "2");
    check("minimum members", ids({ minMembers: 5 }) === "3,4,5");
    check("sort by members", ids({ sort: "members" }) === "5,3,4,2,1");
    check("sort by staff order puts non-staff last", ids({ sort: "order" }) === "1,2,3,4,5");
    check("filters combine", ids({ kinds: ["anyStaff"], minMembers: 2, sort: "members" }) === "3,2");
    check("filter summary", describeFilter({ kinds: ["anyStaff"], orderMin: 2, minMembers: 5, sort: "members" }) === "type: any staff · order 2–… · ≥ 5 members · sorted by members", describeFilter({ kinds: ["anyStaff"], orderMin: 2, minMembers: 5, sort: "members" }));
    check("no filter, no summary", describeFilter({}) === "");
}

// Paging: 15 per page, numbered across pages.
{
    const many = Array.from({ length: 40 }, (_, i) => row({ id: String(i), position: 100 - i }));
    check("15 per page", ROLES_PAGE_SIZE === 15 && pageLines(many, 0).length === 15);
    check("40 roles is 3 pages", pageCount(40) === 3 && pageLines(many, 2).length === 10);
    check("numbering continues on the next page", pageLines(many, 1)[0]!.startsWith("**16.**"));
    check("page clamps", clampPage(9, 40) === 2 && clampPage(-1, 40) === 0 && pageCount(0) === 1);
    check("optional numbers", parseOptionalCount("") === undefined && parseOptionalCount(" 12 ") === 12 && parseOptionalCount("x") === null && parseOptionalCount("-1") === null);
}

// Ids and modals.
{
    check("button ids match", ROLES_BUTTON_ID.test("roles:0a1b2c3d:next") && !ROLES_BUTTON_ID.test("roles:0a1b2c3d:delete"));
    const session = { id: "0a1b2c3d", invokerId: "1", guildName: "G", rows: [], staffApiDown: false, filter: { query: "mod", kinds: ["high" as const], minMembers: 3 }, page: 0, expiresAt: 0 };
    const search = buildRolesSearchModal(session).toJSON() as any;
    const filter = buildRolesFilterModal(session).toJSON() as any;
    check("search modal id matches its handler", ROLES_SEARCH_MODAL_ID.test(search.custom_id));
    check("search reopens with the current query", search.components[0].component.value === "mod");
    check("filter modal id matches its handler", ROLES_FILTER_MODAL_ID.test(filter.custom_id));
    const inner = filter.components.map((l: any) => l.component);
    check("every filter field is optional", inner.every((c: any) => c.required === false));
    check("filter has type select, order range, min members, sort", inner.length === 5 && inner[0].type === ComponentType.StringSelect && inner[4].type === ComponentType.StringSelect);
    check("filter reopens with the current choices", inner[0].options.find((o: any) => o.value === "high").default === true && inner[3].value === "3");
}

// Staff API client, against a fake API.
await (async () => {
    const calls: unknown[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        calls.push(body);
        return new Response(JSON.stringify({ success: true, results: body.roleIds.map((id: string) => ({ roleId: id, isStaffRole: id === "r1", order: id === "r1" ? 3 : null, type: id === "r1" ? "staff" : null })) }));
    }) as typeof fetch;

    const ids = Array.from({ length: 250 }, (_, i) => (i === 0 ? "r1" : `r${i + 1}`));
    const result = await getStaffRoles("g", ids);
    check("batched 100 per request", calls.length === 3);
    check("results merged by role id", result?.size === 250 && result.get("r1")?.order === 3);

    globalThis.fetch = (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    check("API down → null (roles still list)", await getStaffRoles("g", ["r1"]) === null);
    globalThis.fetch = realFetch;
})();

if (failures > 0) {
    console.log(`\n${failures} check(s) failed.`);
    process.exit(1);
}
console.log("\nAll roles checks passed.");
