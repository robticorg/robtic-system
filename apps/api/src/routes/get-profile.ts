import { getProfileSnapshot } from "@core/profile";
import { authenticateRequest } from "../lib/authenticate-request";
import { fetchDiscordProfiles } from "../lib/fetch-discord-avatars";
import { jsonError, API_ERRORS } from "../lib/json-response";

/** GET /api/profile/:userId?guildId=… — omit :userId to get the caller's own profile. */
export async function getProfile(request: Request, url: URL, userIdParam: string | null): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const guildId = url.searchParams.get("guildId");
    if (!guildId) return jsonError(API_ERRORS.guildRequired, 400);

    const targetId = userIdParam ?? viewer.id;
    const isSelf = targetId === viewer.id;

    // The caller's own name/avatar already came back from the token check; only look up other users.
    const discordProfiles = await fetchDiscordProfiles(isSelf ? [] : [targetId]);
    const discordProfile = discordProfiles.get(targetId);

    const snapshot = await getProfileSnapshot({
        guildId,
        targetId,
        viewerId: viewer.id,
        username: isSelf ? viewer.username : (discordProfile?.username ?? targetId),
        avatarUrl: isSelf ? viewer.avatarUrl : (discordProfile?.url ?? null),
    });

    const partnerIds = [snapshot.combo.activePartnerId, snapshot.combo.favoritePartnerId]
        .filter((id): id is string => Boolean(id));
    const partnerProfiles = await fetchDiscordProfiles(partnerIds);

    return Response.json({
        ...snapshot,
        partners: Object.fromEntries(
            partnerIds.map(id => [id, {
                username: partnerProfiles.get(id)?.username ?? id,
                avatarUrl: partnerProfiles.get(id)?.url ?? null,
            }]),
        ),
    });
}
