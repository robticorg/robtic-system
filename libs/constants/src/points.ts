/** Fallback economy rates when a guild has not configured its own. */
export const POINT_DEFAULTS = {
    messagesPerPoint: 100,
    comboPerPoint: 100,
    /** Minutes of *active* voice per Point — voice is slower than chat by design. */
    voiceMinutesPerPoint: 10,
    pointsPerRc: 100,
    minConversionPoints: 100,
} as const;

/** How many ledger rows `/points history` shows. */
export const POINT_HISTORY_PAGE_SIZE = 10;
