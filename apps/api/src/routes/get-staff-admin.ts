import { getStaffOverview } from "@core/staff-admin";
import { authenticateRequest } from "../lib/authenticate-request";
import { isGuildAdmin } from "../lib/is-guild-admin";
import { fetchDiscordProfiles } from "../lib/fetch-discord-avatars";
import { jsonError, API_ERRORS } from "../lib/json-response";

/** GET /api/admin/staff?guildId=… — staff roster + applications + apply types, admins only. */
export async function getStaffAdminRoute(request: Request, url: URL): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const guildId = url.searchParams.get("guildId");
    if (!guildId) return jsonError(API_ERRORS.guildRequired, 400);

    if (!(await isGuildAdmin(guildId, viewer.id))) {
        return jsonError("Admins only", 403);
    }

    const overview = await getStaffOverview(guildId);

    // Applications store only user ids — resolve current usernames for display.
    const profiles = await fetchDiscordProfiles(overview.applications.map(a => a.userId));
    overview.applications = overview.applications.map(application => ({
        ...application,
        username: profiles.get(application.userId)?.username ?? application.userId,
    }));

    return Response.json(overview);
}
