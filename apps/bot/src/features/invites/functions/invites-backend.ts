import { getInviteStats, listInvited, type InviteStats, type InvitedMember } from "@core/invites";
import { invitesApi } from "@internal-client";

/**
 * Where the Gateway reads invite data from: the Invites API when `INVITES_API_URL` is set (the
 * Compose stack), otherwise the same `@core/invites` functions in-process (local dev, or before
 * the API is deployed). One implementation either way — the API serves exactly these functions.
 *
 * With the API configured, its failures surface as `InternalApiError` for the caller to turn into
 * a "temporarily unavailable" message — they are not silently routed around.
 */
const viaApi = () => Boolean(process.env.INVITES_API_URL?.trim());

export const invitesBackend = {
    stats(guildId: string, userId: string, requestId?: string): Promise<InviteStats> {
        return viaApi() ? invitesApi.getStats(guildId, userId, requestId) : getInviteStats(guildId, userId);
    },
    invited(guildId: string, userId: string, skip: number, limit: number, requestId?: string): Promise<{ total: number; rows: InvitedMember[] }> {
        return viaApi() ? invitesApi.listInvited(guildId, userId, skip, limit, requestId) : listInvited(guildId, userId, skip, limit);
    },
};
