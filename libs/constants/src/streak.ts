export const STREAK_CONFIG = {
    claimWindowMs: 24 * 60 * 60 * 1000,
    expireWindowMs: 48 * 60 * 60 * 1000,
    reminderThresholdMs: 2 * 60 * 60 * 1000,
    recoveryWindowMs: 3 * 24 * 60 * 60 * 1000,
    minMessageLength: 5,
    autoDeleteMs: 10_000,
    duplicateWindowMs: 10_000,
    checkIntervalMs: 15 * 60 * 1000,
} as const;
