import { getAdminConfig } from "@core/admin-config";
import { getDevGuildId } from "@core/bot-admin";
import { SuperUserRepository } from "@database/repositories";
import { authenticateRequest } from "../lib/authenticate-request";
import { isGuildAdmin } from "../lib/is-guild-admin";
import { fetchGuildMetadata } from "../lib/fetch-guild-metadata";
import { jsonError, API_ERRORS } from "../lib/json-response";

/**
 * GET /api/admin/config?guildId=… — the Activity's gate bootstrap. Every caller learns their
 * flags (guild admin / super user / whether this guild is the dev server); the config payload
 * itself is only included for guild admins.
 */
export async function getAdminConfigRoute(request: Request, url: URL): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const guildId = url.searchParams.get("guildId");
    if (!guildId) return jsonError(API_ERRORS.guildRequired, 400);

    const [admin, isSuperUser, devGuildId] = await Promise.all([
        isGuildAdmin(guildId, viewer.id),
        SuperUserRepository.isWhitelisted(viewer.id),
        getDevGuildId(),
    ]);
    const flags = {
        isAdmin: admin,
        isSuperUser,
        isDevGuild: Boolean(devGuildId) && devGuildId === guildId,
    };

    if (!admin) {
        // 200 with isAdmin:false so the client can simply hide the tab rather than treat it as an error.
        return Response.json(flags);
    }

    const [config, metadata] = await Promise.all([
        getAdminConfig(guildId),
        fetchGuildMetadata(guildId),
    ]);

    return Response.json({
        ...flags,
        config,
        channels: metadata.channels,
        roles: metadata.roles,
    });
}
