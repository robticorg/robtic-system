interface PartnerMetrics {
    score: number;
    durationMs: number;
    conversations: number;
}

/** Composite "favorite partner" weighting per combo.md: total score + total duration + number of conversations. */
export function favoritePartnerWeight(entry: PartnerMetrics): number {
    return entry.score + (entry.durationMs / 60_000) * 0.5 + entry.conversations * 5;
}
