import type { Profile } from "../types/profile";
import { Avatar } from "./avatar";
import { Icon } from "./icon";
import { formatNumber } from "../utils/format";

interface ComboCardProps {
    combo: Profile["combo"];
    partners: Profile["partners"];
}

export function ComboCard({ combo, partners }: ComboCardProps) {
    const activePartner = combo.activePartnerId ? partners[combo.activePartnerId] : null;
    const favoritePartner = combo.favoritePartnerId ? partners[combo.favoritePartnerId] : null;

    return (
        <section className="card">
            <h2 className="card__title"><Icon name="message" size={14} /> Combo</h2>

            {combo.activeScore !== null ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    {combo.activePartnerId && (
                        <Avatar
                            src={activePartner?.avatarUrl ?? null}
                            name={activePartner?.username ?? "?"}
                            seed={combo.activePartnerId}
                            size={40}
                        />
                    )}
                    <div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "var(--combo)" }}>
                            {formatNumber(combo.activeScore)}
                            {combo.activeLevel && (
                                <span style={{ fontSize: 13, marginLeft: 8, color: "var(--text-dim)" }}>
                                    {combo.activeLevel}
                                </span>
                            )}
                        </div>
                        <div className="muted">
                            Active with {activePartner?.username ?? "someone"}
                        </div>
                    </div>
                </div>
            ) : (
                <p className="muted" style={{ marginTop: 0 }}>No active conversation right now.</p>
            )}

            <div className="stat-grid" style={{ marginTop: 0 }}>
                <div className="stat stat--combo">
                    <span className="stat__label">Best score</span>
                    <div className="stat__value">{formatNumber(combo.bestScore)}</div>
                </div>
                <div className="stat stat--combo">
                    <span className="stat__label">Conversations</span>
                    <div className="stat__value">{formatNumber(combo.totalConversations)}</div>
                </div>
            </div>

            {favoritePartner && (
                <p className="muted" style={{ marginBottom: 0, marginTop: 12 }}>
                    ⭐ Favourite partner: <strong style={{ color: "var(--text)" }}>{favoritePartner.username}</strong>
                </p>
            )}
        </section>
    );
}
