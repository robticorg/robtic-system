import { InternalApiError, unavailableMessage } from "@internal-client";

/**
 * Runs an invites read; if the Invites API is down (timeout, refused, 5xx, malformed), returns the
 * calm "temporarily unavailable" text instead of throwing — the user never sees an internal error.
 * Any other error is a real bug and still propagates to the normal error handler.
 */
export async function orInvitesUnavailable<T>(work: () => Promise<T>): Promise<T | { content: string }> {
    try {
        return await work();
    } catch (err) {
        if (err instanceof InternalApiError) return { content: unavailableMessage("invites") };
        throw err;
    }
}
