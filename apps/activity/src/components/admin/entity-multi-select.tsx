import { useState } from "react";

interface Option {
    id: string;
    name: string;
}

interface EntityMultiSelectProps {
    label: string;
    hint?: string;
    selected: string[];
    options: Option[];
    onChange: (ids: string[]) => void;
}

/** Searchable checklist for picking many channels or roles. */
export function EntityMultiSelect({ label, hint, selected, options, onChange }: EntityMultiSelectProps) {
    const [filter, setFilter] = useState("");
    const selectedSet = new Set(selected);

    function toggle(id: string) {
        const next = new Set(selectedSet);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange([...next]);
    }

    const needle = filter.trim().toLowerCase();
    const visible = needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options;

    return (
        <div className="field">
            <span className="field__label">
                {label}
                <span className="field__count">{selected.length} selected</span>
            </span>
            {hint && <span className="field__hint">{hint}</span>}
            <input
                className="field__filter"
                type="text"
                placeholder="Filter…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            />
            <div className="checklist">
                {visible.length === 0 ? (
                    <p className="muted" style={{ padding: "8px 4px", margin: 0 }}>No matches</p>
                ) : (
                    visible.map((option) => (
                        <label key={option.id} className="checkitem">
                            <input
                                type="checkbox"
                                checked={selectedSet.has(option.id)}
                                onChange={() => toggle(option.id)}
                            />
                            <span>{option.name}</span>
                        </label>
                    ))
                )}
            </div>
        </div>
    );
}
