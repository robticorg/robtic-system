import { TOP_RANK_GAP_SEPARATOR, VIEWER_RANK_SCAN_LIMIT, type ComboLeaderboardPeriod, type TopCategory } from "@constants";
import type { TopEntry } from "@typings/top";
import { getTopEntries } from "../lib";
import { formatTopValue } from "./format-value";

export interface RankPage {
    lines: string[];
    /** The viewer's 1-based rank, 0 when they are unranked or beyond the scan limit. */
    viewerRank: number;
}

export interface RankRow {
    rank: number;
    entry: TopEntry;
    isViewer: boolean;
}

export interface RankRows {
    rows: RankRow[];
    /** True when the viewer's own row (below the page) follows a gap. */
    gapBeforeViewer: boolean;
    /** The viewer's 1-based rank, 0 when they are unranked or beyond the scan limit. */
    viewerRank: number;
    /** How many ranks exist, up to the scan limit — what the page count is worked out from. */
    ranked: number;
}

/** The ranks on one page, plus the viewer's own row when they are further down. The rule is drawn below. */
export async function buildRankRows(
    guildId: string,
    category: TopCategory,
    period: ComboLeaderboardPeriod,
    options: { page?: number; pageSize: number; viewerId?: string },
): Promise<RankRows> {
    const { page = 0, pageSize, viewerId } = options;
    const offset = page * pageSize;

    const scanned = await getTopEntries(guildId, category, period, Math.max(offset + pageSize, VIEWER_RANK_SCAN_LIMIT));
    const slice = scanned.slice(offset, offset + pageSize);

    const viewerIndex = viewerId ? scanned.findIndex(entry => entry.discordId === viewerId) : -1;
    const viewerRank = viewerIndex === -1 ? 0 : viewerIndex + 1;

    const rows: RankRow[] = slice.map((entry, index) => ({ rank: offset + index + 1, entry, isViewer: entry.discordId === viewerId }));
    const onThisPage = viewerRank > offset && viewerRank <= offset + slice.length;
    let gapBeforeViewer = false;

    if (viewerRank > 0 && !onThisPage && viewerRank > offset) {
        gapBeforeViewer = viewerRank > offset + slice.length + 1;
        rows.push({ rank: viewerRank, entry: scanned[viewerIndex]!, isViewer: true });
    }

    return { rows, gapBeforeViewer, viewerRank, ranked: Math.min(scanned.length, VIEWER_RANK_SCAN_LIMIT) };
}

/**
 * One page of a leaderboard as text lines, with the reader's own row always visible.
 *
 * The rule, in the three shapes it takes:
 *
 * ```
 * inside the page      6th of a top 5          40th of a top 5
 * 1.                   1.                      1.
 * 2.                   2.                      2.
 * **3.**               …                       3.
 * 4.                   5.                      4.
 * 5.                   **6.**                  5.
 *                                              …
 *                                              **40.**
 * ```
 *
 * The separator is what makes the third shape honest: without it, rank 40 sitting under rank 5
 * reads as rank 6. It is deliberately absent when the viewer is the very next rank, because there
 * is nothing being skipped over.
 */
export async function buildRankPage(
    guildId: string,
    category: TopCategory,
    period: ComboLeaderboardPeriod,
    unit: string,
    options: {
        /** 0-based. Page 1 of a detail board is ranks 11-20. */
        page?: number;
        pageSize: number;
        viewerId?: string;
    },
): Promise<RankPage> {
    const { rows, gapBeforeViewer, viewerRank } = await buildRankRows(guildId, category, period, options);
    const lines = rows.map(r => formatRow(r.rank, r.entry, category, unit, r.isViewer));
    if (gapBeforeViewer) lines.splice(lines.length - 1, 0, TOP_RANK_GAP_SEPARATOR);
    return { lines, viewerRank };
}

function formatRow(rank: number, entry: TopEntry, category: TopCategory, unit: string, isViewer: boolean): string {
    const line = `${rank}. <@${entry.discordId}> — ${formatTopValue(category, entry.value, unit)}`;
    return isViewer ? `**${line}**` : line;
}
