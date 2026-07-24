import { authenticateRequest } from "../lib/authenticate-request";
import { isGuildAdmin } from "../lib/is-guild-admin";
import { discordBotGet } from "../lib/discord-api";
import { jsonError, API_ERRORS } from "../lib/json-response";

interface BotUser { id: string; username: string; avatar: string | null }
interface BotMember { nick: string | null; avatar: string | null; user?: { id: string } }

let cachedBotUser: BotUser | null = null;

async function getBotUser(): Promise<BotUser | null> {
    if (!cachedBotUser) {
        cachedBotUser = await discordBotGet<BotUser>("/users/@me");
    }
    return cachedBotUser;
}

/** GET /api/admin/bot-profile?guildId=… — the bot's per-server identity (nickname + server avatar). */
export async function getBotProfileRoute(request: Request, url: URL): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const guildId = url.searchParams.get("guildId");
    if (!guildId) return jsonError(API_ERRORS.guildRequired, 400);

    if (!(await isGuildAdmin(guildId, viewer.id))) {
        return jsonError("Admins only", 403);
    }

    const bot = await getBotUser();
    if (!bot) return jsonError("Bot token is not configured", 502);

    const member = await discordBotGet<BotMember>(`/guilds/${guildId}/members/${bot.id}`);

    const guildAvatarUrl = member?.avatar
        ? `https://cdn.discordapp.com/guilds/${guildId}/users/${bot.id}/avatars/${member.avatar}.png?size=128`
        : null;
    const globalAvatarUrl = bot.avatar
        ? `https://cdn.discordapp.com/avatars/${bot.id}/${bot.avatar}.png?size=128`
        : null;

    return Response.json({
        username: bot.username,
        nick: member?.nick ?? null,
        avatarUrl: guildAvatarUrl ?? globalAvatarUrl,
        hasGuildAvatar: Boolean(member?.avatar),
    });
}
