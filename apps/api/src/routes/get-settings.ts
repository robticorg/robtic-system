import { getUserSettings } from "@core/user-settings";
import { authenticateRequest } from "../lib/authenticate-request";
import { jsonError, API_ERRORS } from "../lib/json-response";

/** GET /api/settings — the caller's own bot-wide preferences. */
export async function getSettingsRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    return Response.json(await getUserSettings(viewer.id));
}
