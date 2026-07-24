import { useEffect, useState, type ReactNode } from "react";
import type { ProfileDetails } from "../types/profile";
import { fetchProfileDetails } from "../services/api/api-client";
import { Icon, type IconName } from "./icon";
import { formatDuration, formatNumber, formatTimeAgo } from "../utils/format";

interface ProfileDetailsProps {
    userId: string;
}

/** Collapsible section shell shared by every detail block (same look as the admin accordion). */
function DetailSection({ icon, title, desc, children }: { icon: IconName; title: string; desc: string; children: ReactNode }) {
    const [open, setOpen] = useState(false);

    return (
        <section className={open ? "admin-section admin-section--open" : "admin-section"}>
            <button type="button" className="admin-section__head" onClick={() => setOpen(!open)} aria-expanded={open}>
                <span className="admin-section__icon"><Icon name={icon} size={19} /></span>
                <span className="admin-section__heading">
                    <span className="admin-section__title">{title}</span>
                    <span className="admin-section__desc">{desc}</span>
                </span>
                <Icon name="chevron-down" size={17} className="admin-section__chevron" />
            </button>
            {open && <div className="admin-section__body">{children}</div>}
        </section>
    );
}

function EmptyLine({ text }: { text: string }) {
    return <p className="muted" style={{ margin: 0 }}>{text}</p>;
}

/**
 * The rest of the bot's /profile dropdown — activity log, staff stats, projects, notes and
 * punishment history — fetched once and rendered as collapsible sections under the stat cards.
 */
export function ProfileDetailsPanel({ userId }: ProfileDetailsProps) {
    const [details, setDetails] = useState<ProfileDetails | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setDetails(null);
        setError(null);

        fetchProfileDetails(userId)
            .then((result) => { if (!cancelled) setDetails(result); })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : String(err));
            });

        return () => { cancelled = true; };
    }, [userId]);

    if (error) return null; // Details are additive — a private/failed fetch just hides the sections.
    if (!details) return null;

    const { activity, staff, notes, projects, punishments, punishmentLevel, noteAuthors } = details;

    return (
        <div className="details">
            <DetailSection icon="activity" title="Activity" desc="Recent XP changes and decay status">
                <div className="detail-facts">
                    <span className="detail-fact"><b>{formatNumber(activity.realMessageCount)}</b> real messages</span>
                    <span className="detail-fact">
                        Decay: {activity.decayEnabled
                            ? `active${activity.decayInactiveDays > 0 ? ` — ${activity.decayInactiveDays}d inactive` : ""}`
                            : "disabled"}
                    </span>
                    {activity.decayLastActiveAt !== null && (
                        <span className="detail-fact">Last active {formatTimeAgo(activity.decayLastActiveAt)}</span>
                    )}
                </div>
                {activity.recent.length === 0
                    ? <EmptyLine text="No recent activity." />
                    : (
                        <ul className="detail-list">
                            {activity.recent.map((log, index) => (
                                <li key={index} className="detail-item">
                                    <span className={log.amount >= 0 ? "detail-amount detail-amount--plus" : "detail-amount detail-amount--minus"}>
                                        {log.amount >= 0 ? "+" : ""}{log.amount}
                                    </span>
                                    <span className="detail-item__main">
                                        <span className="detail-item__title">{log.type}</span>
                                        {log.details && <span className="detail-item__sub">{log.details}</span>}
                                    </span>
                                    <span className="detail-item__when">{formatTimeAgo(log.createdAt)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
            </DetailSection>

            {staff && (
                <DetailSection icon="shield" title="Staff activity" desc="Staff points and support performance">
                    <div className="detail-stats">
                        <div className="detail-stat"><span>Support</span><b>{formatNumber(staff.supportPoints)}</b></div>
                        <div className="detail-stat"><span>Public chat</span><b>{formatNumber(staff.publicChatPoints)}</b></div>
                        <div className="detail-stat"><span>Staff chat</span><b>{formatNumber(staff.staffChatPoints)}</b></div>
                        <div className="detail-stat"><span>Moderation</span><b>{formatNumber(staff.moderationPoints)}</b></div>
                        <div className="detail-stat"><span>Penalties</span><b>{formatNumber(staff.penalties)}</b></div>
                        <div className="detail-stat detail-stat--accent"><span>Total</span><b>{formatNumber(staff.totalStaffPoints)}</b></div>
                        <div className="detail-stat"><span>Claimed</span><b>{formatNumber(staff.sessionsClaimed)}</b></div>
                        <div className="detail-stat"><span>Resolved</span><b>{formatNumber(staff.sessionsResolved)}</b></div>
                        <div className="detail-stat"><span>Avg response</span><b>{staff.avgResponseMs > 0 ? formatDuration(staff.avgResponseMs) : "N/A"}</b></div>
                    </div>
                </DetailSection>
            )}

            <DetailSection icon="folder" title="Projects" desc={`${projects.length} shared project${projects.length === 1 ? "" : "s"}`}>
                {projects.length === 0
                    ? <EmptyLine text="No projects shared yet." />
                    : (
                        <ul className="detail-list">
                            {projects.map((project) => (
                                <li key={project.projectId} className="detail-item">
                                    <span className="detail-item__main">
                                        <span className="detail-item__title">{project.title}</span>
                                        <span className="detail-item__sub">
                                            {project.projectType} · 👍 {project.likes} · 👎 {project.dislikes} · {formatNumber(project.views)} views
                                        </span>
                                    </span>
                                    <span className="detail-item__when">{formatTimeAgo(project.createdAt)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
            </DetailSection>

            <DetailSection icon="note" title="Notes" desc={`${notes.length} staff note${notes.length === 1 ? "" : "s"}`}>
                {notes.length === 0
                    ? <EmptyLine text="No notes." />
                    : (
                        <ul className="detail-list">
                            {notes.map((note, index) => (
                                <li key={index} className="detail-item">
                                    <span className="detail-item__main">
                                        <span className="detail-item__title">{note.content}</span>
                                        <span className="detail-item__sub">by {noteAuthors[note.createdBy] ?? note.createdBy}</span>
                                    </span>
                                    <span className="detail-item__when">{formatTimeAgo(note.createdAt)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
            </DetailSection>

            <DetailSection icon="hammer" title="History" desc={`Punishment level ${punishmentLevel}/100 · ${punishments.length} record${punishments.length === 1 ? "" : "s"}`}>
                {punishments.length === 0
                    ? <EmptyLine text="Clean record — no punishments." />
                    : (
                        <ul className="detail-list">
                            {punishments.map((punishment) => (
                                <li key={punishment.caseId} className="detail-item">
                                    <span className={punishment.active && !punishment.appealed ? "status-chip status-chip--danger" : "status-chip"}>
                                        {punishment.appealed ? "appealed" : punishment.active ? "active" : "inactive"}
                                    </span>
                                    <span className="detail-item__main">
                                        <span className="detail-item__title">{punishment.type.toUpperCase()} · {punishment.caseId}</span>
                                        <span className="detail-item__sub">{punishment.reason}</span>
                                    </span>
                                    <span className="detail-item__when">{formatTimeAgo(punishment.createdAt)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
            </DetailSection>
        </div>
    );
}
