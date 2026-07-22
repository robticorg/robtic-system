import type { Profile } from "../types/profile";
import { formatDuration, formatRank } from "../utils/format";
import { Icon } from "./icon";

export function StreakCard({ streak }: { streak: Profile["streak"] }) {
    const claimable = streak.active && streak.nextClaimMs === 0;

    return (
        <section className="card">
            <h2 className="card__title"><Icon name="fire" size={14} /> Streak</h2>
            <div className="stat-grid" style={{ marginTop: 0 }}>
                <div className="stat stat--streak">
                    <span className="stat__label">Current</span>
                    <div className="stat__value">{streak.current}</div>
                    <div className="stat__meta">{formatRank(streak.rank)} in server</div>
                </div>
                <div className="stat stat--streak">
                    <span className="stat__label">Best ever</span>
                    <div className="stat__value">{streak.best}</div>
                    <div className="stat__meta">{formatRank(streak.bestRank)} all-time</div>
                </div>
            </div>

            <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
                {!streak.active
                    ? "No active streak — send a message in the streak channel to start one."
                    : claimable
                        ? "✅ Ready to claim — send a message to extend your streak."
                        : `Next claim in ${formatDuration(streak.nextClaimMs)}` +
                          (streak.expiresInMs !== null ? ` · expires in ${formatDuration(streak.expiresInMs)}` : "")}
            </p>
        </section>
    );
}
