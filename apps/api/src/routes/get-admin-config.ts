import { getAdminConfig } from "@core/admin-config";
import { authenticateRequest } from "../lib/authenticate-request";
import { isGuildAdmin } from "../lib/is-guild-admin";
import { fetchGuildMetadata } from "../lib/fetch-guild-metadata";
import { jsonError, API_ERRORS } from "../lib/json-response";

/** GET /api/admin/config?guildId=… — returns the full config plus channel/role pickers, admins only. */
export async function getAdminConfigRoute(request: Request, url: URL): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const guildId = url.searchParams.get("guildId");
    if (!guildId) return jsonError(API_ERRORS.guildRequired, 400);

    const admin = await isGuildAdmin(guildId, viewer.id);
    if (!admin) {
        // 200 with isAdmin:false so the client can simply hide the tab rather than treat it as an error.
        return Response.json({ isAdmin: false });
    }

    const [config, metadata] = await Promise.all([
        getAdminConfig(guildId),
        fetchGuildMetadata(guildId),
    ]);

    return Response.json({
        isAdmin: true,
        config,
        channels: metadata.channels,
        roles: metadata.roles,
    });
}
