export const STAFF_POINTS = {
    publicChatPerMessage: 1,
    staffChatPerMessage: 1,
    maxPublicPerHour: 5,
    maxStaffPerHour: 2,
} as const;

export const SUPPORT_POINTS = {
    fastResponseMs: 60_000,
    fastResponsePoints: 5,
    normalResponseMs: 300_000,
    normalResponsePoints: 3,
    slowResponseMs: 900_000,
    slowResponsePoints: 1,
    noResponsePenalty: -2,
    claimAbandonPenalty: -3,
} as const;
