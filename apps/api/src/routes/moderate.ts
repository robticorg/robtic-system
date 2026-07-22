import { authenticateRequest } from "../lib/authenticate-request";
import { isGuildAdmin } from "../lib/is-guild-admin";
import { moderateMember, type ModerationAction } from "../lib/discord-moderation";
import { jsonError, API_ERRORS } from "../lib/json-response";

const ACTIONS: ModerationAction[] = ["ban", "unban", "kick", "timeout", "untimeout"];
const MAX_TIMEOUT_HOURS = 24 * 28; // Discord's hard cap is 28 days.
const DELETE_MESSAGES_SECONDS = 24 * 60 * 60;

/** POST /api/admin/moderate — { guildId, action, userId, reason?, durationHours?, deleteMessages? }. Admins only. */
export async function moderateRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const body = await request.json().catch(() => null) as {
        guildId?: string;
        action?: string;
        userId?: string;
        reason?: string;
        durationHours?: number;
        deleteMessages?: boolean;
    } | null;

    if (!body?.guildId) return jsonError(API_ERRORS.guildRequired, 400);
    if (!body.userId || !/^\d{15,25}$/.test(body.userId)) return jsonError(API_ERRORS.userRequired, 400);
    if (!body.action || !ACTIONS.includes(body.action as ModerationAction)) {
        return jsonError("A valid moderation action is required", 400);
    }

    if (body.userId === viewer.id) return jsonError("You can't moderate yourself.", 400);

    const admin = await isGuildAdmin(body.guildId, viewer.id);
    if (!admin) return jsonError("Administrator access is required", 403);

    const action = body.action as ModerationAction;
    const reason = `${body.reason?.trim() || "No reason provided"} — by ${viewer.username}`;

    let until: string | null | undefined;
    if (action === "timeout") {
        const hours = Math.min(Math.max(Number(body.durationHours) || 1, 1), MAX_TIMEOUT_HOURS);
        until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    const result = await moderateMember(body.guildId, body.userId, action, {
        reason,
        until,
        deleteMessageSeconds: action === "ban" && body.deleteMessages ? DELETE_MESSAGES_SECONDS : 0,
    });

    if (!result.ok) return jsonError(result.error ?? "The action failed.", 502);
    return Response.json({ ok: true });
}
