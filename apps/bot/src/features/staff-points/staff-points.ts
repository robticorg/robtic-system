import { defineFeature } from "@typings/feature";
import { STAFF_MESSAGE_POINTS_FEATURE } from "@core/staff-api";

/**
 * One staff point (external staff API, type "msg") for every 100 real messages a staff member
 * sends. No commands of its own — it exists so a server can switch it with
 * `/feature disable staff-points` / `/feature enable staff-points`.
 *
 * `default-on`: every server keeps the behavior it had before the switch existed. The worker sends
 * these points and doesn't load manifests, so the check (`isStaffMessagePointsEnabled`) reads the
 * server's choice directly, with the same default.
 */
export const staffPointsFeature = defineFeature({
    key: STAFF_MESSAGE_POINTS_FEATURE,
    description: "Staff points for every 100 messages",
    activation: "default-on",
    commands: [],
});
