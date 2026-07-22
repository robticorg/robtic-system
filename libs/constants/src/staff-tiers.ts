/**
 * Score thresholds a guild's StaffTier scores are measured against.
 * A guild configuring its own tiers should follow the same convention
 * for manager/lead checks to mean anything for it.
 */
export const STAFF_TIER_THRESHOLDS = {
    staff: 20,
    manager: 80,
    lead: 90,
    owner: 100,
} as const;
