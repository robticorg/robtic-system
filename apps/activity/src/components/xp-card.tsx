import type { Profile } from "../types/profile";
import { formatNumber } from "../utils/format";
import { Icon } from "./icon";

export function XpCard({ xp }: { xp: Profile["xp"] }) {
    const percent = xp.needed > 0 ? Math.min(100, Math.round((xp.progress / xp.needed) * 100)) : 0;

    return (
        <section className="card">
            <h2 className="card__title"><Icon name="zap" size={14} /> Experience</h2>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 26, fontWeight: 700 }}>Level {xp.level}</span>
                <span className="muted">{formatNumber(xp.totalXP)} total XP</span>
            </div>
            <div className="progress">
                <div className="progress__fill progress__fill--xp" style={{ width: `${percent}%` }} />
            </div>
            <div className="progress-row">
                <span>{formatNumber(xp.progress)} / {formatNumber(xp.needed)} XP</span>
                <span>{percent}% to level {xp.level + 1}</span>
            </div>
        </section>
    );
}
