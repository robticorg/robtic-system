import { authenticateRequest } from "../lib/authenticate-request";
import { isGuildAdmin } from "../lib/is-guild-admin";
import { discordBotPatch } from "../lib/discord-api";
import { jsonError, API_ERRORS } from "../lib/json-response";

const NICK_MAX_LENGTH = 32;
const BIO_MAX_LENGTH = 190;
/** Discord accepts data-URI avatars; cap the payload so nobody uploads a monster. */
const AVATAR_DATA_URI_MAX_LENGTH = 4 * 1024 * 1024;
const AVATAR_DATA_URI_PATTERN = /^data:image\/(png|jpeg|jpg|gif);base64,[A-Za-z0-9+/=]+$/;

interface BotProfileUpdate {
    guildId?: string;
    /** Empty string clears the nickname. */
    nick?: string;
    /** Data URI sets the per-server avatar; null clears it back to the global one. */
    avatar?: string | null;
    /** Per-server bio ("About Me"); empty string clears it. */
    bio?: string;
}

/**
 * POST /api/admin/bot-profile — updates the bot's per-server identity via Discord's
 * "Modify Current Member" endpoint (nick / avatar / bio are all server-scoped), admins only.
 */
export async function updateBotProfileRoute(request: Request): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const body = await request.json().catch(() => null) as BotProfileUpdate | null;
    if (!body?.guildId) return jsonError(API_ERRORS.guildRequired, 400);

    if (!(await isGuildAdmin(body.guildId, viewer.id))) {
        return jsonError("Admins only", 403);
    }

    const payload: Record<string, unknown> = {};

    if (typeof body.nick === "string") {
        payload.nick = body.nick.trim().slice(0, NICK_MAX_LENGTH) || null;
    }

    if (body.avatar === null) {
        payload.avatar = null;
    } else if (typeof body.avatar === "string") {
        if (body.avatar.length > AVATAR_DATA_URI_MAX_LENGTH) {
            return jsonError("Avatar image is too large (max ~3MB)", 400);
        }
        if (!AVATAR_DATA_URI_PATTERN.test(body.avatar)) {
            return jsonError("Avatar must be a png/jpeg/gif data URI", 400);
        }
        payload.avatar = body.avatar;
    }

    if (typeof body.bio === "string") {
        payload.bio = body.bio.trim().slice(0, BIO_MAX_LENGTH) || null;
    }

    if (Object.keys(payload).length === 0) {
        return jsonError("Nothing to update", 400);
    }

    const result = await discordBotPatch(`/guilds/${body.guildId}/members/@me`, payload);
    if (!result.ok) return jsonError(result.error, 502);

    return Response.json({ ok: true });
}
