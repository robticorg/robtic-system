import type { UserSettingsUpdate } from "@typings/user-settings";
import { updateUserSettings } from "@core/user-settings";
import { authenticateRequest } from "../lib/authenticate-request";
import { jsonError, API_ERRORS } from "../lib/json-response";

/**
 * POST /api/settings {lang?, displayName?, privateProfile?} — updates the caller's own
 * preferences. The bot reads the same UserRepository fields, so a language change here
 * switches every localized bot reply too. Values are re-validated in core.
 */
export async function updateSettingsRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const body = await request.json().catch(() => null) as UserSettingsUpdate | null;
    if (!body || typeof body !== "object") return jsonError("A JSON body is required", 400);

    const settings = await updateUserSettings(viewer.id, viewer.username, body);
    return Response.json(settings);
}
