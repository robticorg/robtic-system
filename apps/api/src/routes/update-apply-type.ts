import { setApplyOpen } from "@core/staff-admin";
import { authenticateRequest } from "../lib/authenticate-request";
import { isGuildAdmin } from "../lib/is-guild-admin";
import { jsonError, API_ERRORS } from "../lib/json-response";

/** POST /api/admin/staff/apply {guildId, key, isOpen} — opens/closes one application type, admins only. */
export async function updateApplyTypeRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const body = await request.json().catch(() => null) as
        { guildId?: string; key?: string; isOpen?: boolean } | null;
    if (!body?.guildId || typeof body.key !== "string" || typeof body.isOpen !== "boolean") {
        return jsonError("guildId, key and isOpen are required", 400);
    }

    if (!(await isGuildAdmin(body.guildId, viewer.id))) {
        return jsonError("Admins only", 403);
    }

    const found = await setApplyOpen(body.guildId, body.key, body.isOpen);
    if (!found) return jsonError("Unknown application type", 404);

    return Response.json({ ok: true, key: body.key, isOpen: body.isOpen });
}
