import type { InviteStats, InvitedMember } from "@core/invites";
import { callInternalApi } from "./request";

/** The Invites API (`internal-api/invites`), at `INVITES_API_URL`. */
export const invitesApi = {
    getStats: (guildId: string, userId: string, requestId?: string) =>
        callInternalApi<InviteStats>("invites", "INVITES_API_URL", `/invites/${guildId}/members/${userId}/stats`, { requestId }),

    listInvited: (guildId: string, userId: string, skip: number, limit: number, requestId?: string) =>
        callInternalApi<{ total: number; rows: InvitedMember[] }>("invites", "INVITES_API_URL", `/invites/${guildId}/members/${userId}/invited`, {
            requestId,
            query: { skip, limit },
        }),
};
