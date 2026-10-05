import { Logger } from "@logger";
import { staffApiHeaders, staffApiUrl } from "../staff-api";

/** Every this many real messages, the author earns one staff point. */
export const MESSAGES_PER_STAFF_POINT = 100;

/**
 * Sends one staff point to the internal points API when `messageCount` lands on a multiple of
 * MESSAGES_PER_STAFF_POINT. The idempotency key is derived from the milestone, so a retried or
 * duplicated call never awards the same hundred messages twice.
 *
 * Fire-and-forget: never throws, and a 404 (author is not staff in that guild) is expected.
 */
export async function awardMessageMilestone(guildId: string, userId: string, messageCount: number): Promise<void> {
    if (messageCount <= 0 || messageCount % MESSAGES_PER_STAFF_POINT !== 0) return;

    try {
        const res = await fetch(staffApiUrl("/internal/staff/points"), {
            method: "POST",
            headers: staffApiHeaders(),
            body: JSON.stringify({
                guildId,
                userId,
                amount: 1,
                reason: `Reached ${messageCount} messages`,
                // One of the API's known point transaction types ("msg", "ticket", …).
                type: "msg",
                idempotencyKey: `messages:${guildId}:${userId}:${messageCount}`,
            }),
            signal: AbortSignal.timeout(5_000),
        });

        if (res.status === 404) {
            Logger.debug(`[staff-points] ${userId} hit ${messageCount} messages but is not staff in ${guildId}`);
            return;
        }
        if (!res.ok) {
            Logger.warn(`[staff-points] ${res.status} awarding ${userId} in ${guildId}: ${await res.text().catch(() => "")}`);
            return;
        }

        const body = (await res.json().catch(() => null)) as { balance?: number } | null;
        Logger.debug(`[staff-points] +1 to ${userId} in ${guildId} at ${messageCount} messages (balance=${body?.balance})`);
    } catch (err) {
        Logger.warn(`[staff-points] Request failed for ${userId} in ${guildId}: ${err}`);
    }
}
