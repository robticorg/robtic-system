import { useEffect, useState } from "react";
import type { LeaderboardResponse, LeaderboardRow, TopCategory, TopPeriod } from "../types/profile";
import { fetchLeaderboard } from "../services/api/api-client";
import { Avatar } from "../components/avatar";
import { Icon, type IconName } from "../components/icon";
import { formatNumber } from "../utils/format";

const CATEGORIES: { value: TopCategory; label: string; icon: IconName }[] = [
    { value: "streak", label: "Streak", icon: "fire" },
    { value: "combo", label: "Combo", icon: "message" },
    { value: "xp", label: "XP", icon: "zap" },
    { value: "messages", label: "Messages", icon: "activity" },
];

const PERIODS: { value: TopPeriod; label: string }[] = [
    { value: "daily", label: "Today" },
    { value: "weekly", label: "Week" },
    { value: "monthly", label: "Month" },
    { value: "alltime", label: "All time" },
];

const MEDALS = ["🥇", "🥈", "🥉"];

function Row({ row, isViewer, onSelect }: { row: LeaderboardRow; isViewer: boolean; onSelect: (id: string) => void }) {
    return (
        <li>
            <button
                type="button"
                className={`row${isViewer ? " row--viewer" : ""}`}
                onClick={() => onSelect(row.discordId)}
            >
                <span className="row__rank">{MEDALS[row.rank - 1] ?? row.rank}</span>
                <Avatar src={row.avatarUrl} name={row.displayName} seed={row.discordId} size={32} />
                <span className="row__name">{row.displayName}</span>
                <span className="row__value">{formatNumber(row.value)}</span>
            </button>
        </li>
    );
}

export function LeaderboardView({ onSelectUser }: { onSelectUser: (userId: string) => void }) {
    const [category, setCategory] = useState<TopCategory>("streak");
    const [period, setPeriod] = useState<TopPeriod>("alltime");
    const [data, setData] = useState<LeaderboardResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        setError(null);

        fetchLeaderboard(category, period)
            .then((result) => { if (!cancelled) setData(result); })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : String(err));
            });

        return () => { cancelled = true; };
    }, [category, period]);

    const viewerInRows = data?.viewer
        ? data.rows.some((row) => row.discordId === data.viewer!.discordId)
        : false;
    const showViewerGap = Boolean(data?.viewer) && !viewerInRows;

    return (
        <>
            <div className="filters">
                {CATEGORIES.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className="chip"
                        aria-pressed={category === option.value}
                        onClick={() => setCategory(option.value)}
                    >
                        <Icon name={option.icon} size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                        {option.label}
                    </button>
                ))}
            </div>

            <div className="filters">
                {PERIODS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        className="chip"
                        aria-pressed={period === option.value}
                        onClick={() => setPeriod(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {error && <p className="error">{error}</p>}
            {!error && !data && <div className="spinner" aria-label="Loading leaderboard" />}

            {data && (
                data.rows.length === 0 ? (
                    <p className="muted">No entries for this period yet.</p>
                ) : (
                    <ul className="rows">
                        {data.rows.map((row) => (
                            <Row
                                key={row.discordId}
                                row={row}
                                isViewer={row.discordId === data.viewer?.discordId}
                                onSelect={onSelectUser}
                            />
                        ))}

                        {showViewerGap && (
                            <>
                                <li className="row__gap">···</li>
                                <Row row={data.viewer!} isViewer onSelect={onSelectUser} />
                            </>
                        )}
                    </ul>
                )
            )}
        </>
    );
}
