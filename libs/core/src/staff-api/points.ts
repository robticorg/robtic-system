import { GuildFeatureRepository } from "@database/repositories";
import { Logger } from "@logger";
import { staffApiHeaders, staffApiUrl } from "./client";

/** Every this many real messages, the author earns one staff point. */
export const MESSAGES_PER_STAFF_POINT = 100;

/** The per-server switch: `/feature disable staff-points`. */
export const STAFF_MESSAGE_POINTS_FEATURE = "staff-points";

/**
 * Whether this server gives staff points for messages — on unless the server turned it off. Reads
 * the server's `/feature` choice directly (not through the manifest registry) because the worker,
 * which sends these points, doesn't load feature manifests. Cached 60s, so a change reaches the
 * worker within a minute.
 */
export async function isStaffMessagePointsEnabled(guildId: string): Promise<boolean> {
    const overrides = await GuildFeatureRepository.getOverrides(guildId);
    return overrides.get(STAFF_MESSAGE_POINTS_FEATURE) ?? true;
}

/**
 * The milestones crossed when a member's real-message count went from `total - added` to `total`.
 * A flush can add many messages at once, so it can cross more than one multiple — each one counts.
 */
export function crossedMilestones(total: number, added: number, every = MESSAGES_PER_STAFF_POINT): number[] {
    if (!(added > 0) || !(total > 0) || !(every > 0)) return [];
    const from = Math.max(0, total - added);
    const out: number[] = [];
    for (let m = (Math.floor(from / every) + 1) * every; m <= total; m += every) out.push(m);
    return out;
}

/** The staff API refused the request in a way a retry can't fix (validation, auth). */
export class StaffApiRejected extends Error {
    constructor(readonly status: number, message: string) {
        super(message);
        this.name = "StaffApiRejected";
    }
}

/**
 * Sends one staff point for reaching `messageCount` messages. The idempotency key is derived from
 * the milestone, so a retried request never awards the same hundred messages twice.
 *
 * Result: `"sent"`, or `"not-staff"` (404 — the member isn't staff there; expected and final).
 * Throws on a timeout, network error or 5xx (retry), or `StaffApiRejected` on any other 4xx (don't).
 */
export async function sendMessageMilestone(guildId: string, userId: string, messageCount: number): Promise<"sent" | "not-staff"> {
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

    if (res.status === 404) return "not-staff";
    if (res.status >= 500) throw new Error(`staff API ${res.status}`);
    if (!res.ok) throw new StaffApiRejected(res.status, await res.text().catch(() => ""));
    return "sent";
}

/**
 * The inline (no-Redis) path: sends the milestones crossed by one message. Fire-and-forget — never
 * throws, logs instead, exactly like the pre-queue behavior.
 */
export async function awardMessageMilestone(guildId: string, userId: string, messageCount: number): Promise<void> {
    const milestones = crossedMilestones(messageCount, 1);
    if (!milestones.length || !(await isStaffMessagePointsEnabled(guildId).catch(() => true))) return;
    for (const milestone of milestones) {
        try {
            const result = await sendMessageMilestone(guildId, userId, milestone);
            Logger.debug(`[staff-points] ${userId} in ${guildId} at ${milestone} messages: ${result}`, "staff-api");
        } catch (err) {
            Logger.warn(`[staff-points] ${userId} in ${guildId} at ${milestone}: ${(err as Error).message}`, "staff-api");
        }
    }
}
