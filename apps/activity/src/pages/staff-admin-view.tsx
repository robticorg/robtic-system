import { useEffect, useState } from "react";
import type { StaffApplication, StaffOverview } from "../types/staff-admin";
import { fetchStaffOverview, setApplyTypeOpen } from "../services/api/api-client";
import { Icon } from "../components/icon";
import { formatTimeAgo } from "../utils/format";

const STATUS_CHIP_CLASS: Record<string, string> = {
    "active": "status-chip status-chip--ok",
    "on-leave": "status-chip status-chip--pending",
    "suspended": "status-chip status-chip--danger",
    "terminated": "status-chip status-chip--danger",
};

function ApplicationItem({ application }: { application: StaffApplication }) {
    const [open, setOpen] = useState(false);

    return (
        <li className="detail-item detail-item--stack">
            <button type="button" className="application__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                <span className={application.isApproved ? "status-chip status-chip--ok" : "status-chip status-chip--pending"}>
                    {application.isApproved ? "approved" : "pending"}
                </span>
                <span className="detail-item__main">
                    <span className="detail-item__title">{application.username}</span>
                    <span className="detail-item__sub">{application.department}</span>
                </span>
                <span className="detail-item__when">{formatTimeAgo(application.createdAt)}</span>
                <Icon name="chevron-down" size={15} className={open ? "application__chevron application__chevron--open" : "application__chevron"} />
            </button>

            {open && (
                <div className="application__answers">
                    {application.answers.map((entry, index) => (
                        <div key={index} className="application__answer">
                            <span className="application__question">{entry.question}</span>
                            <span className="application__text">{entry.answer}</span>
                        </div>
                    ))}
                </div>
            )}
        </li>
    );
}

/** Admin-only: application types (open/close), submitted applications, and the staff roster. */
export function StaffAdminView() {
    const [overview, setOverview] = useState<StaffOverview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [togglingKey, setTogglingKey] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchStaffOverview()
            .then((result) => { if (!cancelled) setOverview(result); })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : String(err));
            });
        return () => { cancelled = true; };
    }, []);

    if (error) return <p className="error">{error}</p>;
    if (!overview) return <div className="spinner" aria-label="Loading staff data" />;

    async function toggleType(key: string, isOpen: boolean) {
        setTogglingKey(key);
        try {
            await setApplyTypeOpen(key, isOpen);
            setOverview((current) => current && {
                ...current,
                types: current.types.map((type) => type.key === key ? { ...type, isOpen } : type),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setTogglingKey(null);
        }
    }

    return (
        <div className="settings">
            <div className="card">
                <h2 className="card__title"><Icon name="note" size={15} /> Applications — open / closed</h2>
                <div className="apply-types">
                    {overview.types.map((type) => (
                        <div key={type.key} className="field field--row">
                            <span className="field__label">
                                {type.name}
                                <span className="field__hint">{type.questionCount} question{type.questionCount === 1 ? "" : "s"}</span>
                            </span>
                            <button
                                type="button"
                                className={type.isOpen ? "switch switch--on" : "switch"}
                                role="switch"
                                aria-checked={type.isOpen}
                                disabled={togglingKey === type.key}
                                onClick={() => toggleType(type.key, !type.isOpen)}
                            >
                                <span className="switch__dot" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card">
                <h2 className="card__title"><Icon name="pencil" size={15} /> Submitted applications ({overview.applications.length})</h2>
                {overview.applications.length === 0
                    ? <p className="muted" style={{ margin: 0 }}>No applications waiting.</p>
                    : (
                        <ul className="detail-list">
                            {overview.applications.map((application) => (
                                <ApplicationItem key={application.userId} application={application} />
                            ))}
                        </ul>
                    )}
            </div>

            <div className="card">
                <h2 className="card__title"><Icon name="users" size={15} /> Staff members ({overview.staff.length})</h2>
                {overview.staff.length === 0
                    ? <p className="muted" style={{ margin: 0 }}>No staff records yet.</p>
                    : (
                        <ul className="detail-list">
                            {overview.staff.map((member) => (
                                <li key={member.discordId} className="detail-item">
                                    <span className={STATUS_CHIP_CLASS[member.status] ?? "status-chip"}>{member.status}</span>
                                    <span className="detail-item__main">
                                        <span className="detail-item__title">{member.username}</span>
                                        <span className="detail-item__sub">
                                            {member.department} — {member.position}
                                            {member.warningCount > 0 && ` · ⚠️ ${member.warningCount} warning${member.warningCount === 1 ? "" : "s"}`}
                                        </span>
                                    </span>
                                    <span className="detail-item__when">hired {formatTimeAgo(member.hiredAt)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
            </div>
        </div>
    );
}
