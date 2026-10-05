import { optionalInt, requireSnowflake, type InternalRoute } from "@internal-api";
import { getInviteStats, listInvited, type InviteStats, type InvitedMember } from "@core/invites";

/**
 * Invites API routes. Reads only — joins and leaves arrive through the `invites` queue and are
 * written by the worker, so the Gateway never waits on them.
 *
 * Services are injectable so the routes can be tested without a database.
 */
export interface InvitesService {
    stats(guildId: string, userId: string): Promise<InviteStats>;
    invited(guildId: string, userId: string, skip: number, limit: number): Promise<{ total: number; rows: InvitedMember[] }>;
}

export const invitesService: InvitesService = {
    stats: (guildId, userId) => getInviteStats(guildId, userId),
    invited: (guildId, userId, skip, limit) => listInvited(guildId, userId, skip, limit),
};

const MEMBER = String.raw`/invites/([^/]+)/members/([^/]+)`;

export function invitesRoutes(service: InvitesService = invitesService): InternalRoute[] {
    return [
        {
            method: "GET",
            path: new RegExp(`^${MEMBER}/stats$`),
            handler: async ({ params }) => service.stats(requireSnowflake(params[0], "guildId"), requireSnowflake(params[1], "userId")),
        },
        {
            method: "GET",
            path: new RegExp(`^${MEMBER}/invited$`),
            handler: async ({ params, url }) => service.invited(
                requireSnowflake(params[0], "guildId"),
                requireSnowflake(params[1], "userId"),
                optionalInt(url.searchParams.get("skip"), "skip", 0, 0, 1_000_000),
                optionalInt(url.searchParams.get("limit"), "limit", 10, 1, 100),
            ),
        },
    ];
}
