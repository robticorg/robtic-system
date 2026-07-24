import { SuperUserRepository } from "@database/repositories";
import { getDevGuildId, setDevGuildId } from "@core/bot-admin";
import { authenticateRequest } from "../lib/authenticate-request";
import { jsonError, API_ERRORS } from "../lib/json-response";

const GUILD_ID_PATTERN = /^\d{15,25}$/;

/**
 * POST /api/bot-admin/config {devGuildId} — writes bot-wide settings, super users only.
 * An empty/null devGuildId clears it (Projects then stays hidden everywhere).
 */
export async function updateBotAdminConfigRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    if (!(await SuperUserRepository.isWhitelisted(viewer.id))) {
        return jsonError("Only super users can change bot settings", 403);
    }

    const body = await request.json().catch(() => null) as { devGuildId?: string | null } | null;
    if (!body || typeof body !== "object") return jsonError("A JSON body is required", 400);

    const raw = typeof body.devGuildId === "string" ? body.devGuildId.trim() : "";
    if (raw && !GUILD_ID_PATTERN.test(raw)) {
        return jsonError("devGuildId must be a Discord guild id", 400);
    }

    await setDevGuildId(raw || null);

    return Response.json({
        isSuperUser: true,
        devGuildId: await getDevGuildId(),
    });
}
