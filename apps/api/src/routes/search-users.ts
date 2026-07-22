import { searchProfiles } from "@core/profile";
import { authenticateRequest } from "../lib/authenticate-request";
import { fetchDiscordProfiles } from "../lib/fetch-discord-avatars";
import { jsonError, API_ERRORS } from "../lib/json-response";

/** GET /api/search?guildId=…&q=… — autocomplete source for the profile search box. */
export async function searchUsers(request: Request, url: URL): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const guildId = url.searchParams.get("guildId");
    if (!guildId) return jsonError(API_ERRORS.guildRequired, 400);

    const query = url.searchParams.get("q") ?? "";
    const results = await searchProfiles(guildId, query);

    const avatars = await fetchDiscordProfiles(results.map(r => r.discordId));

    return Response.json({
        results: results.map(r => ({
            ...r,
            avatarUrl: avatars.get(r.discordId)?.url ?? null,
        })),
    });
}
