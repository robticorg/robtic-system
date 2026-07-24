import { useEffect, useState } from "react";
import type { OwnProject } from "../types/projects";
import { fetchMyProjects, submitProject } from "../services/api/api-client";
import { Icon } from "../components/icon";
import { formatNumber, formatTimeAgo } from "../utils/format";

const PROJECT_TYPES = [
    { id: "web", label: "Web" },
    { id: "discord", label: "Discord" },
    { id: "other", label: "Other" },
];

const TITLE_LIMITS = { min: 3, max: 100 };
const DESCRIPTION_LIMITS = { min: 10, max: 2000 };

/** Share a new project (goes to the dev team's review channel) and track your submissions. */
export function ProjectsView() {
    const [projects, setProjects] = useState<OwnProject[] | null>(null);
    const [listError, setListError] = useState<string | null>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [projectType, setProjectType] = useState("web");
    const [link, setLink] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

    function loadProjects() {
        fetchMyProjects()
            .then(setProjects)
            .catch((err: unknown) => setListError(err instanceof Error ? err.message : String(err)));
    }

    useEffect(loadProjects, []);

    const canSubmit =
        title.trim().length >= TITLE_LIMITS.min &&
        description.trim().length >= DESCRIPTION_LIMITS.min &&
        !submitting;

    async function handleSubmit() {
        setSubmitting(true);
        setStatus(null);
        try {
            await submitProject({ title: title.trim(), description: description.trim(), projectType, link: link.trim() || undefined });
            setTitle("");
            setDescription("");
            setLink("");
            setStatus({ kind: "ok", text: "Submitted! The dev team will review your project." });
            loadProjects();
        } catch (err) {
            setStatus({ kind: "err", text: err instanceof Error ? err.message : String(err) });
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="projects">
            <div className="card">
                <h2 className="card__title"><Icon name="rocket" size={15} /> Share a project</h2>
                <p className="muted" style={{ margin: "0 0 12px" }}>
                    Submissions are reviewed by the dev team before they're published to everyone.
                </p>

                <div className="field">
                    <span className="field__label">Title <span className="field__hint">{TITLE_LIMITS.min}–{TITLE_LIMITS.max} characters</span></span>
                    <input
                        className="field__input"
                        value={title}
                        maxLength={TITLE_LIMITS.max}
                        placeholder="A concise title for your project"
                        onChange={(event) => setTitle(event.target.value)}
                    />
                </div>

                <div className="field" style={{ marginTop: 12 }}>
                    <span className="field__label">Description <span className="field__hint">{DESCRIPTION_LIMITS.min}–{DESCRIPTION_LIMITS.max} characters</span></span>
                    <textarea
                        className="field__input projects__textarea"
                        value={description}
                        maxLength={DESCRIPTION_LIMITS.max}
                        rows={5}
                        placeholder="A detailed description of your project"
                        onChange={(event) => setDescription(event.target.value)}
                    />
                </div>

                <div className="projects__meta-row">
                    <div className="field">
                        <span className="field__label">Type</span>
                        <select className="field__select" value={projectType} onChange={(event) => setProjectType(event.target.value)}>
                            {PROJECT_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                        </select>
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                        <span className="field__label"><Icon name="link" size={13} /> Link <span className="field__hint">optional</span></span>
                        <input
                            className="field__input"
                            value={link}
                            placeholder="https://github.com/you/project"
                            onChange={(event) => setLink(event.target.value)}
                        />
                    </div>
                </div>

                <div className="mod__run">
                    {status && (
                        <span className={status.kind === "ok" ? "mod__status mod__status--ok" : "mod__status mod__status--err"}>
                            <Icon name={status.kind === "ok" ? "check" : "alert"} size={14} /> {status.text}
                        </span>
                    )}
                    <button type="button" className="run-button" disabled={!canSubmit} onClick={handleSubmit}>
                        <Icon name="plus" size={16} /> {submitting ? "Submitting…" : "Submit for review"}
                    </button>
                </div>
            </div>

            <div className="card">
                <h2 className="card__title"><Icon name="folder" size={15} /> Your projects</h2>
                {listError && <p className="error">{listError}</p>}
                {!projects && !listError && <div className="spinner" aria-label="Loading projects" />}
                {projects && projects.length === 0 && <p className="muted" style={{ margin: 0 }}>Nothing here yet — share your first project above.</p>}
                {projects && projects.length > 0 && (
                    <ul className="detail-list">
                        {projects.map((project) => (
                            <li key={`${project.status}-${project.projectId}`} className="detail-item">
                                <span className={project.status === "published" ? "status-chip status-chip--ok" : "status-chip status-chip--pending"}>
                                    {project.status}
                                </span>
                                <span className="detail-item__main">
                                    <span className="detail-item__title">{project.title}</span>
                                    <span className="detail-item__sub">
                                        {project.projectType}
                                        {project.status === "published" && ` · 👍 ${project.likes} · ${formatNumber(project.views)} views`}
                                    </span>
                                </span>
                                <span className="detail-item__when">{formatTimeAgo(project.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
