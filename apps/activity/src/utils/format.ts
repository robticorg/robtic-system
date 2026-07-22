export function formatNumber(value: number): string {
    return value.toLocaleString();
}

/** Compact "2d 4h" / "35m" style duration, matching the bot's formatDuration output shape. */
export function formatDuration(ms: number): string {
    if (ms <= 0) return "now";

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

export function formatRank(rank: number): string {
    return rank > 0 ? `#${rank}` : "—";
}
