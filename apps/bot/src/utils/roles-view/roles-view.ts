import type { StaffRoleInfo, StaffRoleType } from "@bot/services/staff-api";

/**
 * The `?roles` panel's rules — classification, filters, sorting, paging and the line format —
 * kept pure so they can be tested without Discord.
 */

export const ROLES_PAGE_SIZE = 15;

/** What a role is: its staff type from the staff API, or what Discord says about it. */
export type RoleKind = StaffRoleType | "bot" | "booster" | "member";

export const ROLE_KIND_LABELS: Record<RoleKind, string> = {
    owner: "👑 Owner",
    high: "⭐ High staff",
    staff: "🛡️ Staff",
    ship: "🚢 Ship",
    bot: "🤖 Bot",
    booster: "💎 Booster",
    member: "👤 Member",
};

export interface RoleRow {
    id: string;
    name: string;
    /** Discord position — higher is higher in the role list. */
    position: number;
    members: number;
    kind: RoleKind;
    /** Staff ladder order (from 1 at the bottom); `null` for non-staff roles. */
    order: number | null;
}

export type RoleSort = "position" | "members" | "order";

export interface RoleFilter {
    /** Name contains (case-insensitive), or an exact role id. */
    query?: string;
    /** Any of these kinds; empty = all. `"anyStaff"` matches every staff type. */
    kinds?: Array<RoleKind | "anyStaff">;
    orderMin?: number;
    orderMax?: number;
    minMembers?: number;
    sort?: RoleSort;
}

const STAFF_KINDS: ReadonlySet<RoleKind> = new Set(["owner", "high", "staff", "ship"]);

export function classifyRole(
    role: { id: string; managed: boolean; isBoosterRole: boolean },
    staff: StaffRoleInfo | undefined,
): { kind: RoleKind; order: number | null } {
    if (staff?.isStaffRole && staff.type) return { kind: staff.type, order: staff.order ?? null };
    if (role.isBoosterRole) return { kind: "booster", order: null };
    if (role.managed) return { kind: "bot", order: null };
    return { kind: "member", order: null };
}

export function applyRoleFilter(rows: readonly RoleRow[], filter: RoleFilter): RoleRow[] {
    const query = filter.query?.trim().toLowerCase();
    const kinds = filter.kinds?.length ? new Set(filter.kinds) : null;

    const matched = rows.filter(row => {
        if (query && !(row.name.toLowerCase().includes(query) || row.id === query)) return false;
        if (kinds && !(kinds.has(row.kind) || (kinds.has("anyStaff") && STAFF_KINDS.has(row.kind)))) return false;
        if (filter.orderMin !== undefined && !(row.order !== null && row.order >= filter.orderMin)) return false;
        if (filter.orderMax !== undefined && !(row.order !== null && row.order <= filter.orderMax)) return false;
        if (filter.minMembers !== undefined && row.members < filter.minMembers) return false;
        return true;
    });

    const sort = filter.sort ?? "position";
    return matched.sort((a, b) => {
        if (sort === "members") return b.members - a.members || b.position - a.position;
        if (sort === "order") return (b.order ?? -1) - (a.order ?? -1) || b.position - a.position;
        return b.position - a.position;
    });
}

export function pageCount(total: number): number {
    return Math.max(1, Math.ceil(total / ROLES_PAGE_SIZE));
}

export function clampPage(page: number, total: number): number {
    return Math.min(Math.max(0, Math.floor(page) || 0), pageCount(total) - 1);
}

/** `N. <@&id> | type | #order | N members` — the order part only for staff roles. */
export function roleLine(row: RoleRow, index: number): string {
    return [
        `**${index + 1}.** <@&${row.id}>`,
        ROLE_KIND_LABELS[row.kind],
        ...(row.order !== null ? [`#${row.order}`] : []),
        `${row.members} member${row.members === 1 ? "" : "s"}`,
    ].join(" | ");
}

/** The lines for one page, numbered across the whole (filtered) list. */
export function pageLines(rows: readonly RoleRow[], page: number): string[] {
    const start = clampPage(page, rows.length) * ROLES_PAGE_SIZE;
    return rows.slice(start, start + ROLES_PAGE_SIZE).map((row, i) => roleLine(row, start + i));
}

/** "type: Staff, High staff · order 2–9 · ≥ 5 members · sorted by members" — empty when nothing is set. */
export function describeFilter(filter: RoleFilter): string {
    const parts: string[] = [];
    if (filter.query) parts.push(`search: "${filter.query}"`);
    if (filter.kinds?.length) parts.push(`type: ${filter.kinds.map(k => (k === "anyStaff" ? "any staff" : ROLE_KIND_LABELS[k].replace(/^\S+ /, ""))).join(", ")}`);
    if (filter.orderMin !== undefined || filter.orderMax !== undefined) parts.push(`order ${filter.orderMin ?? "…"}–${filter.orderMax ?? "…"}`);
    if (filter.minMembers !== undefined) parts.push(`≥ ${filter.minMembers} members`);
    if (filter.sort && filter.sort !== "position") parts.push(`sorted by ${filter.sort}`);
    return parts.join(" · ");
}

/** A whole number ≥ 0 from a modal field, `undefined` when empty, `null` when invalid. */
export function parseOptionalCount(raw: string | null | undefined): number | undefined | null {
    const value = raw?.trim();
    if (!value) return undefined;
    return /^\d{1,6}$/.test(value) ? Number(value) : null;
}
