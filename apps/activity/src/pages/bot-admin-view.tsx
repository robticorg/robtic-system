import { useEffect, useState } from "react";
import { fetchBotAdminConfig, saveBotAdminConfig } from "../services/api/api-client";
import { Icon } from "../components/icon";

interface BotAdminViewProps {
    /** The guild this Activity is currently open in, for the "use this server" shortcut. */
    currentGuildId: string;
}

/**
 * Bot-wide settings panel, visible to whitelisted super users only (the guild admin panel is a
 * separate, per-guild surface). Currently holds the dev server id that unlocks the Projects area.
 */
export function BotAdminView({ currentGuildId }: BotAdminViewProps) {
    const [devGuildId, setDevGuildId] = useState("");
    const [loaded, setLoaded] = useState(false);
    const [saved, setSaved] = useState<string>("");
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchBotAdminConfig()
            .then((config) => {
                if (cancelled) return;
                if (!config.isSuperUser) {
                    setError("Only super users can open the bot admin panel.");
                    return;
                }
                setDevGuildId(config.devGuildId ?? "");
                setSaved(config.devGuildId ?? "");
                setLoaded(true);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : String(err));
            });
        return () => { cancelled = true; };
    }, []);

    if (error) return <p className="error">{error}</p>;
    if (!loaded) return <div className="spinner" aria-label="Loading bot settings" />;

    async function apply(value: string) {
        setSaving(true);
        setStatus(null);
        try {
            const next = await saveBotAdminConfig(value.trim() || null);
            setDevGuildId(next.devGuildId ?? "");
            setSaved(next.devGuildId ?? "");
            setStatus({ kind: "ok", text: next.devGuildId ? "Dev server saved" : "Dev server cleared" });
        } catch (err) {
            setStatus({ kind: "err", text: err instanceof Error ? err.message : String(err) });
        } finally {
            setSaving(false);
        }
    }

    const dirty = devGuildId.trim() !== saved;

    return (
        <div className="settings">
            <p className="muted" style={{ margin: 0 }}>
                Bot-wide settings — these apply to every server the bot is in.
            </p>

            <div className="card">
                <h2 className="card__title"><Icon name="hash" size={15} /> Dev server</h2>
                <p className="muted" style={{ margin: "0 0 10px" }}>
                    The Projects area only appears when the Activity is opened inside this server.
                    Leave empty to hide Projects everywhere.
                </p>
                <div className="name-row">
                    <input
                        className="field__input"
                        value={devGuildId}
                        placeholder="Guild id, e.g. 123456789012345678"
                        onChange={(event) => setDevGuildId(event.target.value)}
                    />
                    <button type="button" className="save-button" disabled={saving || !dirty} onClick={() => apply(devGuildId)}>
                        Save
                    </button>
                </div>
                <div className="bot-admin__shortcuts">
                    <button
                        type="button"
                        className="ghost-button"
                        disabled={saving || saved === currentGuildId}
                        onClick={() => apply(currentGuildId)}
                    >
                        Use this server ({currentGuildId})
                    </button>
                    <button
                        type="button"
                        className="ghost-button"
                        disabled={saving || !saved}
                        onClick={() => apply("")}
                    >
                        Clear
                    </button>
                </div>
            </div>

            {status && (
                <p className={status.kind === "ok" ? "mod__status mod__status--ok" : "mod__status mod__status--err"}>
                    <Icon name={status.kind === "ok" ? "check" : "alert"} size={14} /> {status.text}
                </p>
            )}
        </div>
    );
}
