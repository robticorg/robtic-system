import { useState } from "react";
import type { AdminConfigSection, AdminConfigSnapshot } from "../types/admin";
import { useSectionSave } from "./use-section-save";

/** Local draft + baseline for one config section, plus a commit that saves and re-baselines on success. */
export function useSectionEditor<S extends AdminConfigSection>(section: S, initial: AdminConfigSnapshot[S]) {
    const [baseline, setBaseline] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const { status, save } = useSectionSave(section);

    const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

    async function commit(): Promise<void> {
        const saved = await save(draft);
        if (saved) {
            setBaseline(saved);
            setDraft(saved);
        }
    }

    return { draft, setDraft, dirty, status, commit };
}
