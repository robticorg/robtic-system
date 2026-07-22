/** Named score tiers for the Combo System. Ordered ascending; must stay sorted for level lookups to work. */
export const COMBO_LEVELS = [
    { name: "Bronze", minScore: 0 },
    { name: "Silver", minScore: 30 },
    { name: "Gold", minScore: 70 },
    { name: "Diamond", minScore: 140 },
    { name: "Legendary", minScore: 260 },
] as const;

export type ComboLevelName = typeof COMBO_LEVELS[number]["name"];

export const COMBO_CONFIG = {
    /** A combo expires after this long without a qualifying interaction between the pair. */
    expireMs: 2 * 60 * 1000,
    /** Periodic sweep interval: expiry, heat decay, leaderboard snapshots, champion role sync. */
    scanIntervalMs: 30_000,
    /** Heat halves roughly every this many ms of silence. */
    heatHalfLifeMs: 45_000,
    heatGainAlternating: 16,
    heatGainSame: 6,
    minMessageLength: 4,
    minScorePerMessage: 2,
    maxScorePerMessage: 7,
    /** Minimum combined confidence for the conversation detector to attribute a message to a partner. */
    detectionConfidenceThreshold: 0.3,
    /** Signals older than this are no longer considered for detection (mirrors the combo expiry window). */
    detectionWindowMs: 2 * 60 * 1000,
    /** Per-channel in-memory ring buffer size used for alternation/recency detection. */
    recentBufferSize: 12,
    /** How long an untouched channel's detection buffer is kept before being pruned. */
    channelBufferTtlMs: 10 * 60 * 1000,
    historyPageSize: 10,
    leaderboardLimit: 10,
    /** Cap on distinct partners tracked per user for Favorite Partner, to bound document growth. */
    maxTrackedPartners: 25,
    /** Punishment-level (0-100, see PunishmentRepository) at/above which a message author's combo score gain is dampened. */
    punishmentGateThreshold: 50,
    /** Multiplier applied to scoreGain once punishmentGateThreshold is met — dampened, not zeroed. */
    punishmentGateMultiplier: 0.4,
} as const;

/** TTL of the per-guild score-range cache on the message hot path. */
export const COMBO_SCORE_RANGE_CACHE_TTL_MS = 60_000;

/** Heat is clamped to this range; it's display-only and never ends a combo. */
export const COMBO_HEAT_BOUNDS = { min: 0, max: 100 } as const;

/** Heat halves each half-life period of silence. */
export const COMBO_HEAT_DECAY_FACTOR = 0.5;

/** Heat values at which the status label changes. */
export const COMBO_HEAT_THRESHOLDS = {
    veryActive: 80,
    active: 50,
    cooling: 20,
} as const;

/**
 * Weights for each conversation-partner detection signal. Recency decay is tuned for realistic
 * typing/reply pacing (people often take 30-90s to respond), not just near-instant replies — a
 * stricter curve caused normally-paced conversations to silently stop scoring after the first
 * quick exchange.
 */
export const COMBO_DETECTION_WEIGHTS = {
    reply: 0.6,
    mention: 0.3,
    recencyUnder20s: 0.45,
    recencyUnder60s: 0.35,
    recencyUnder120s: 0.22,
    continuityBase: 0.25,
    continuityScoreMax: 0.2,
    /** Combo score at which the continuity bonus reaches continuityScoreMax. */
    continuityScoreCeiling: 30,
} as const;

/** Recency decay tier boundaries, in ms. */
export const COMBO_DETECTION_RECENCY_TIERS = {
    fast: 20_000,
    medium: 60_000,
    slow: 120_000,
} as const;

/** Arabic heat status labels shown on combo embeds. */
export const COMBO_HEAT_LABELS = {
    veryActive: "نشط جداً",
    active: "نشط",
    cooling: "يبرد",
    cold: "بارد",
} as const;

export type ComboLeaderboardPeriod = "daily" | "weekly" | "monthly" | "alltime";
export const COMBO_LEADERBOARD_PERIODS: ComboLeaderboardPeriod[] = ["daily", "weekly", "monthly", "alltime"];

export type ComboLeaderboardType = "combo" | "streak" | "partner";
