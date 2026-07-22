import { useState, type ReactNode } from "react";
import type { SaveStatus } from "../../hooks/use-section-save";
import { Icon, type IconName } from "../icon";

interface SectionShellProps {
    title: string;
    description: string;
    icon: IconName;
    status: SaveStatus;
    dirty: boolean;
    onSave: () => void;
    children: ReactNode;
}

function statusLabel(status: SaveStatus): string {
    switch (status.state) {
        case "saving": return "Saving…";
        case "saved": return "✓ Saved";
        case "error": return status.message;
        default: return "";
    }
}

/** Collapsible card for one config section: icon + heading toggles it open; fields and Save live inside. */
export function SectionShell({ title, description, icon, status, dirty, onSave, children }: SectionShellProps) {
    const [open, setOpen] = useState(false);

    return (
        <section className={`admin-section${open ? " admin-section--open" : ""}`}>
            <button type="button" className="admin-section__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                <span className="admin-section__icon"><Icon name={icon} size={20} /></span>
                <span className="admin-section__heading">
                    <span className="admin-section__title">{title}</span>
                    <span className="admin-section__desc">{description}</span>
                </span>
                {dirty && !open && <span className="admin-section__dot" title="Unsaved changes" />}
                <span className="admin-section__chevron"><Icon name="chevron-down" size={18} /></span>
            </button>

            {open && (
                <>
                    <div className="admin-section__body">{children}</div>
                    <footer className="admin-section__foot">
                        <span className={`admin-section__status${status.state === "error" ? " admin-section__status--error" : ""}`}>
                            {statusLabel(status)}
                        </span>
                        <button
                            type="button"
                            className="save-button"
                            disabled={status.state === "saving" || !dirty}
                            onClick={onSave}
                        >
                            Save changes
                        </button>
                    </footer>
                </>
            )}
        </section>
    );
}
