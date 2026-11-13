export type TopCategory =
    | "messages-xp"
    | "voice-xp"
    | "streak"
    | "combo"
    | "points"
    | "messages"
    | "voice"
    | "xp";

export const TOP_CATEGORIES: TopCategory[] = [
    "messages-xp",
    "voice-xp",
    "streak",
    "combo",
    "points",
    "messages",
    "voice",
    "xp",
];

/**
 * What a bare `/top` shows: the text and voice boards, five ranks each, paged together down the ranking. Every other
 * board opens by name (`/top combo`), ten ranks a page.
 */
export const TOP_OVERVIEW_BOARDS: readonly TopCategory[] = ["messages", "voice"];

/** The `/top` accent (the bar down the side and the chart line) when a server hasn't picked one. */
export const TOP_DEFAULT_ACCENT = "#e5212d";

/** Emoji shown in each leaderboard's title. */
export const TOP_CATEGORY_EMOJI: Record<TopCategory, string> = {
    "messages-xp": "⭐",
    "voice-xp": "🎧",
    streak: "🔥",
    combo: "💬",
    points: "🎯",
    messages: "📨",
    voice: "🎙️",
    xp: "📈",
};

/** Ranks shown per category on a `/top` page. */
export const TOP_DISPLAY_LIMIT = 5;

/** Ranks shown per page when one category is asked for by name — `/top combo`. */
export const TOP_DETAIL_LIMIT = 10;

/** Overview value, meaning "every category at once" rather than one of them. */
export const TOP_ALL_CATEGORIES = "all";

/**
 * How far to scan for the viewer's own rank when they are outside the shown page.
 *
 * A cap rather than a count query: past a hundred the exact number stops meaning much, and the
 * board says "not ranked" instead of paying for a scan nobody reads.
 */
export const VIEWER_RANK_SCAN_LIMIT = 100;

/** Separator inserted when the viewer's rank is far below the displayed top. */
export const TOP_RANK_GAP_SEPARATOR = "…";

/** Lookback windows for period-scoped streak leaderboards. */
export const TOP_PERIOD_TO_DAYS: Record<"weekly" | "monthly", number> = { weekly: 7, monthly: 30 };
