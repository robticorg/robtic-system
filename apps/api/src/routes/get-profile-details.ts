import { getProfileDetails } from "@core/profile";
import { authenticateRequest } from "../lib/authenticate-request";
import { fetchDiscordProfiles } from "../lib/fetch-discord-avatars";
import { jsonError, API_ERRORS } from "../lib/json-response";

/**
 * GET /api/profile/:userId/details?guildId=… — the dropdown sections beyond the snapshot
 * (activity log, staff stats, notes, projects, punishment history). Private profiles only
 * return details to their owner.
 */
export async function getProfileDetailsRoute(request: Request, url: URL, targetId: string): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const guildId = url.searchParams.get("guildId");
    if (!guildId) return jsonError(API_ERRORS.guildRequired, 400);

    const isSelf = targetId === viewer.id;
    const discordProfiles = await fetchDiscordProfiles(isSelf ? [] : [targetId]);

    const details = await getProfileDetails({
        guildId,
        targetId,
        viewerId: viewer.id,
        username: isSelf ? viewer.username : (discordProfiles.get(targetId)?.username ?? targetId),
    });

    if (!details) return jsonError("This profile is private", 403);

    // Resolve note-author ids so the client can label who wrote each note.
    const authorIds = [...new Set(details.notes.map(note => note.createdBy))];
    const authorProfiles = await fetchDiscordProfiles(authorIds);

    return Response.json({
        ...details,
        noteAuthors: Object.fromEntries(
            authorIds.map(id => [id, authorProfiles.get(id)?.username ?? id]),
        ),
    });
}
