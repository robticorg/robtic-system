import { SuperUserRepository } from "@database/repositories";
import { getDevGuildId } from "@core/bot-admin";
import { authenticateRequest } from "../lib/authenticate-request";
import { jsonError, API_ERRORS } from "../lib/json-response";

/**
 * GET /api/bot-admin/config — bot-wide settings, super users only. Non-supers get
 * `{isSuperUser:false}` (200) so the client can simply hide the tab.
 */
export async function getBotAdminConfigRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    if (!(await SuperUserRepository.isWhitelisted(viewer.id))) {
        return Response.json({ isSuperUser: false });
    }

    return Response.json({
        isSuperUser: true,
        devGuildId: await getDevGuildId(),
    });
}
