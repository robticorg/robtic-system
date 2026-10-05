import { Logger } from "@logger";

/**
 * The internal staff API (the staff bot on the host): one place for its address and auth, shared
 * by staff points and the `?roles` panel.
 *
 * The bot runs in a Docker container, where 127.0.0.1 is the container itself — so the default is
 * the host's LAN address. Override with STAFF_POINTS_API_URL (e.g. a Compose service name).
 */
const DEFAULT_API_URL = "http://192.168.1.146:8788";
const CTX = "staff-api";

export function staffApiUrl(path: string): string {
    return `${(process.env.STAFF_POINTS_API_URL || DEFAULT_API_URL).replace(/\/+$/, "")}${path}`;
}

export function staffApiHeaders(): Record<string, string> {
    const token = process.env.STAFF_POINTS_API_TOKEN;
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export type StaffRoleType = "staff" | "high" | "owner" | "ship";

export interface StaffRoleInfo {
    roleId: string;
    isStaffRole: boolean;
    /** Position from the bottom of the staff ladder, from 1. `null` for a non-staff role. */
    order: number | null;
    type: StaffRoleType | null;
}

/** The API takes at most this many roles per request. */
const BATCH = 100;

/**
 * Staff info for many roles, by role id — batched 100 per request (`POST /internal/staff/role`).
 * `null` when the API can't be reached or answers with an error: callers show the roles without
 * staff info rather than failing.
 */
export async function getStaffRoles(guildId: string, roleIds: readonly string[]): Promise<Map<string, StaffRoleInfo> | null> {
    const result = new Map<string, StaffRoleInfo>();
    try {
        for (let i = 0; i < roleIds.length; i += BATCH) {
            const res = await fetch(staffApiUrl("/internal/staff/role"), {
                method: "POST",
                headers: staffApiHeaders(),
                body: JSON.stringify({ guildId, roleIds: roleIds.slice(i, i + BATCH) }),
                signal: AbortSignal.timeout(5_000),
            });
            if (!res.ok) {
                Logger.warn(`${res.status} from /internal/staff/role: ${await res.text().catch(() => "")}`, CTX);
                return null;
            }
            const body = await res.json() as { results?: StaffRoleInfo[] };
            for (const row of body.results ?? []) result.set(row.roleId, row);
        }
        return result;
    } catch (err) {
        Logger.warn(`Staff role lookup failed: ${err}`, CTX);
        return null;
    }
}
