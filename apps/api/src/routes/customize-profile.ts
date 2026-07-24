import type { ProfileCustomizationUpdate } from "@core/user-settings";
import { updateProfileCustomization } from "@core/user-settings";
import { authenticateRequest } from "../lib/authenticate-request";
import { discordBotPatch } from "../lib/discord-api";
import { jsonError, API_ERRORS } from "../lib/json-response";

/**
 * POST /api/profile/customize — self-service profile look (display name, accent color, banner,
 * bio, layout template). Always writes the caller's own record; values re-validated in core.
 * A display-name change also updates the member's server nickname (best effort — the bot needs
 * Manage Nicknames and role hierarchy above the member).
 */
export async function customizeProfileRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const body = await request.json().catch(() => null) as (ProfileCustomizationUpdate & { guildId?: string }) | null;
    if (!body || typeof body !== "object") return jsonError("A JSON body is required", 400);

    await updateProfileCustomization(viewer.id, viewer.username, body);

    let nickApplied = false;
    const nick = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 32) : "";
    if (nick && body.guildId) {
        const result = await discordBotPatch(`/guilds/${body.guildId}/members/${viewer.id}`, { nick });
        nickApplied = result.ok;
    }

    return Response.json({ ok: true, nickApplied });
}
