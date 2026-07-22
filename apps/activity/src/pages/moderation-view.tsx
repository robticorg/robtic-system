import { useState } from "react";
import type { SearchResult } from "../types/profile";
import { moderateUser, type ModerationAction } from "../services/api/api-client";
import { UserSearch } from "../components/user-search";
import { Avatar } from "../components/avatar";
import { Icon, type IconName } from "../components/icon";

interface ActionDef {
    action: ModerationAction;
    label: string;
    icon: IconName;
    danger: boolean;
    /** Requires a second confirming click. */
    confirm: boolean;
}

const ACTIONS: ActionDef[] = [
    { action: "ban", label: "Ban", icon: "hammer", danger: true, confirm: true },
    { action: "kick", label: "Kick", icon: "user-x", danger: true, confirm: true },
    { action: "timeout", label: "Timeout", icon: "clock", danger: false, confirm: false },
    { action: "untimeout", label: "Remove timeout", icon: "check", danger: false, confirm: false },
    { action: "unban", label: "Unban", icon: "ban", danger: false, confirm: false },
];

const DURATIONS: { hours: number; label: string }[] = [
    { hours: 1, label: "1 hour" },
    { hours: 6, label: "6 hours" },
    { hours: 24, label: "1 day" },
    { hours: 72, label: "3 days" },
    { hours: 168, label: "7 days" },
    { hours: 672, label: "28 days" },
];

type Status =
    | { state: "idle" }
    | { state: "confirm" }
    | { state: "working" }
    | { state: "done"; message: string }
    | { state: "error"; message: string };

export function ModerationView() {
    const [target, setTarget] = useState<SearchResult | null>(null);
    const [action, setAction] = useState<ModerationAction>("ban");
    const [reason, setReason] = useState("");
    const [durationHours, setDurationHours] = useState(24);
    const [deleteMessages, setDeleteMessages] = useState(false);
    const [status, setStatus] = useState<Status>({ state: "idle" });

    const current = ACTIONS.find((a) => a.action === action)!;

    function reset() {
        setStatus({ state: "idle" });
    }

    function pickTarget(result: SearchResult) {
        setTarget(result);
        setStatus({ state: "idle" });
    }

    async function run() {
        if (!target) return;
        setStatus({ state: "working" });
        try {
            await moderateUser({
                action,
                userId: target.discordId,
                reason: reason.trim() || undefined,
                durationHours: action === "timeout" ? durationHours : undefined,
                deleteMessages: action === "ban" ? deleteMessages : undefined,
            });
            setStatus({ state: "done", message: `${current.label} applied to ${target.displayName}.` });
            setReason("");
        } catch (err) {
            setStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
        }
    }

    function primaryClick() {
        if (current.confirm && status.state !== "confirm") {
            setStatus({ state: "confirm" });
            return;
        }
        void run();
    }

    if (!target) {
        return (
            <div className="mod">
                <div className="mod__intro card">
                    <Icon name="scale" size={22} />
                    <div>
                        <h2 style={{ margin: "0 0 2px", fontSize: 15 }}>Moderation</h2>
                        <p className="muted" style={{ margin: 0 }}>Search a member to ban, kick, or time out.</p>
                    </div>
                </div>
                <UserSearch onSelect={pickTarget} placeholder="Search the member to moderate…" />
            </div>
        );
    }

    return (
        <div className="mod">
            <div className="mod__target card">
                <Avatar src={target.avatarUrl} name={target.displayName} seed={target.discordId} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target.displayName}</div>
                    <div className="muted">@{target.username}</div>
                </div>
                <button type="button" className="ghost-button" onClick={() => { setTarget(null); reset(); }}>Change</button>
            </div>

            <div className="mod__actions">
                {ACTIONS.map((a) => (
                    <button
                        key={a.action}
                        type="button"
                        className={`mod-action${action === a.action ? " mod-action--active" : ""}${a.danger ? " mod-action--danger" : ""}`}
                        onClick={() => { setAction(a.action); reset(); }}
                    >
                        <Icon name={a.icon} size={18} />
                        {a.label}
                    </button>
                ))}
            </div>

            <div className="card">
                {action === "timeout" && (
                    <label className="field">
                        <span className="field__label">Duration</span>
                        <select className="field__select" value={durationHours} onChange={(e) => setDurationHours(Number(e.target.value))}>
                            {DURATIONS.map((d) => <option key={d.hours} value={d.hours}>{d.label}</option>)}
                        </select>
                    </label>
                )}

                {action === "ban" && (
                    <label className="field field--row" style={{ marginBottom: 14 }}>
                        <span className="field__label">Delete last 24h of messages</span>
                        <input type="checkbox" checked={deleteMessages} onChange={(e) => setDeleteMessages(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--accent)" }} />
                    </label>
                )}

                <label className="field">
                    <span className="field__label">Reason</span>
                    <input
                        className="field__input"
                        type="text"
                        value={reason}
                        placeholder="Shown in the audit log (optional)"
                        maxLength={400}
                        onChange={(e) => { setReason(e.target.value); reset(); }}
                    />
                </label>

                <div className="mod__run">
                    {status.state === "done" && <span className="mod__status mod__status--ok"><Icon name="check" size={16} /> {status.message}</span>}
                    {status.state === "error" && <span className="mod__status mod__status--err"><Icon name="alert" size={16} /> {status.message}</span>}
                    {status.state === "confirm" && <span className="mod__status mod__status--warn">Tap again to confirm</span>}

                    <button
                        type="button"
                        className={`run-button${current.danger ? " run-button--danger" : ""}`}
                        disabled={status.state === "working"}
                        onClick={primaryClick}
                    >
                        <Icon name={current.icon} size={17} />
                        {status.state === "working" ? "Working…" : status.state === "confirm" ? `Confirm ${current.label.toLowerCase()}` : `${current.label} ${target.displayName}`}
                    </button>
                </div>
            </div>
        </div>
    );
}
