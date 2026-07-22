import { useState } from "react";
import type { AdminConfigSection, AdminConfigSnapshot } from "../types/admin";
import { saveAdminSection } from "../services/api/api-client";

export type SaveStatus =
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved" }
    | { state: "error"; message: string };

/** Wraps one section's save call with status tracking so each card can show its own Save/Saved/Error state. */
export function useSectionSave<S extends AdminConfigSection>(section: S) {
    const [status, setStatus] = useState<SaveStatus>({ state: "idle" });

    async function save(values: AdminConfigSnapshot[S]): Promise<AdminConfigSnapshot[S] | null> {
        setStatus({ state: "saving" });
        try {
            const snapshot = await saveAdminSection(section, values);
            setStatus({ state: "saved" });
            setTimeout(() => setStatus((s) => (s.state === "saved" ? { state: "idle" } : s)), 2200);
            return snapshot[section];
        } catch (err) {
            setStatus({ state: "error", message: err instanceof Error ? err.message : String(err) });
            return null;
        }
    }

    return { status, save };
}
