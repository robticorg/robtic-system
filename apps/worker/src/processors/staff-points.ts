import { UnrecoverableError } from "bullmq";
import { StaffApiRejected, isStaffMessagePointsEnabled, sendMessageMilestone } from "@core/staff-api";
import type { StaffPointJob } from "@queue";

/**
 * The `staff-points` queue: one staff point per 100 messages, sent to the external staff API.
 * Timeouts, network errors and 5xx retry with backoff; a 4xx other than 404 can't be fixed by
 * retrying, so it fails permanently. The API's idempotency key makes a retried send harmless.
 */

const SNOWFLAKE = /^\d{17,20}$/;

export async function processStaffPointJob(
    job: StaffPointJob,
    send: typeof sendMessageMilestone = sendMessageMilestone,
    enabled: (guildId: string) => Promise<boolean> = isStaffMessagePointsEnabled,
): Promise<"sent" | "not-staff" | "disabled"> {
    if (!SNOWFLAKE.test(job.guildId) || !SNOWFLAKE.test(job.memberId)) throw new UnrecoverableError("invalid guild or member id");
    if (!Number.isInteger(job.milestone) || job.milestone <= 0) throw new UnrecoverableError("invalid milestone");
    // Checked when sending, so a server that turns it off also stops points already queued.
    if (!(await enabled(job.guildId))) return "disabled";

    try {
        return await send(job.guildId, job.memberId, job.milestone);
    } catch (err) {
        if (err instanceof StaffApiRejected) throw new UnrecoverableError(`staff API rejected (${err.status}): ${err.message}`);
        throw err;
    }
}
