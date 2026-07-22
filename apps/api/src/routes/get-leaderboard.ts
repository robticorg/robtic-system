import { getLeaderboardPage } from "@core/leaderboard";
import { TOP_CATEGORIES, COMBO_LEADERBOARD_PERIODS, type ComboLeaderboardPeriod, type TopCategory } from "@constants";
import { authenticateRequest } from "../lib/authenticate-request";
import { fetchDiscordProfiles } from "../lib/fetch-discord-avatars";
import { jsonError, API_ERRORS } from "../lib/json-response";

/** GET /api/top?guildId=…&category=…&period=… — same data the /top command renders. */
export async function getLeaderboard(request: Request, url: URL): Promise<Response> {
    const viewer = await authenticateRequest(request);
    if (!viewer) return jsonError(API_ERRORS.unauthorized, 401);

    const guildId = url.searchParams.get("guildId");
    if (!guildId) return jsonError(API_ERRORS.guildRequired, 400);

    const requestedCategory = url.searchParams.get("category") as TopCategory | null;
    const requestedPeriod = url.searchParams.get("period") as ComboLeaderboardPeriod | null;

    const category = requestedCategory && TOP_CATEGORIES.includes(requestedCategory)
        ? requestedCategory
        : TOP_CATEGORIES[0];
    const period = requestedPeriod && COMBO_LEADERBOARD_PERIODS.includes(requestedPeriod)
        ? requestedPeriod
        : "alltime";

    const page = await getLeaderboardPage(guildId, category, period, viewer.id);

    const ids = [...page.rows.map(r => r.discordId), ...(page.viewer ? [page.viewer.discordId] : [])];
    const avatars = await fetchDiscordProfiles(ids);
    const withAvatar = <T extends { discordId: string }>(row: T) => ({
        ...row,
        avatarUrl: avatars.get(row.discordId)?.url ?? null,
    });

    return Response.json({
        ...page,
        rows: page.rows.map(withAvatar),
        viewer: page.viewer ? withAvatar(page.viewer) : null,
    });
}
