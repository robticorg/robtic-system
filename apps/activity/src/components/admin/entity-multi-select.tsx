import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icon";

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

/**
 * Tag-style multi-select: chosen entries render as removable chips, typing searches the options
 * in a dropdown. Arrow keys navigate, Enter toggles, Backspace on an empty query removes the
 * last chip, Escape closes.
 */
export function EntityMultiSelect({ label, hint, selected, options, onChange }: EntityMultiSelectProps) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const nameById = useMemo(() => new Map(options.map((o) => [o.id, o.name])), [options]);

    const needle = query.trim().toLowerCase();
    const visible = useMemo(
        () => (needle ? options.filter((o) => o.name.toLowerCase().includes(needle)) : options),
        [options, needle],
    );

    // Keep the highlighted row inside the filtered list as it shrinks.
    useEffect(() => {
        if (activeIndex >= visible.length) setActiveIndex(0);
    }, [visible.length, activeIndex]);

    // Close when clicking anywhere outside the control.
    useEffect(() => {
        if (!open) return;
        function handlePointerDown(event: PointerEvent) {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
        }
        window.addEventListener("pointerdown", handlePointerDown);
        return () => window.removeEventListener("pointerdown", handlePointerDown);
    }, [open]);

    function toggle(id: string) {
        onChange(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
        setQuery("");
        inputRef.current?.focus();
    }

    function remove(id: string) {
        onChange(selected.filter((s) => s !== id));
        inputRef.current?.focus();
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((i) => Math.min(i + 1, Math.max(0, visible.length - 1)));
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
        } else if (event.key === "Enter") {
            event.preventDefault();
            if (open && visible[activeIndex]) toggle(visible[activeIndex].id);
        } else if (event.key === "Escape") {
            setOpen(false);
        } else if (event.key === "Backspace" && query === "" && selected.length > 0) {
            remove(selected[selected.length - 1]);
        }
    }

    return (
        <div className="field" ref={rootRef}>
            <span className="field__label">
                {label}
                {selected.length > 0 && <span className="field__count">{selected.length}</span>}
            </span>
            {hint && <span className="field__hint">{hint}</span>}

            <div
                className={`mselect${open ? " mselect--open" : ""}`}
                onClick={() => { setOpen(true); inputRef.current?.focus(); }}
            >
                {selected.map((id) => (
                    <span key={id} className="mselect__chip">
                        {nameById.get(id) ?? id}
                        <button
                            type="button"
                            className="mselect__remove"
                            aria-label={`Remove ${nameById.get(id) ?? id}`}
                            onClick={(event) => { event.stopPropagation(); remove(id); }}
                        >
                            <Icon name="x" size={11} />
                        </button>
                    </span>
                ))}

                <input
                    ref={inputRef}
                    className="mselect__input"
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    placeholder={selected.length === 0 ? "Search…" : ""}
                    value={query}
                    onFocus={() => setOpen(true)}
                    onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }}
                    onKeyDown={handleKeyDown}
                />

                <Icon name="chevron-down" size={14} className={`mselect__caret${open ? " mselect__caret--open" : ""}`} />
            </div>

            {open && (
                <ul className="mselect__list" role="listbox" aria-multiselectable="true">
                    {visible.length === 0 ? (
                        <li className="mselect__empty">No matches for "{query.trim()}"</li>
                    ) : (
                        visible.map((option, index) => {
                            const isSelected = selectedSet.has(option.id);
                            return (
                                <li key={option.id} role="none">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        className="mselect__option"
                                        data-active={index === activeIndex}
                                        onMouseEnter={() => setActiveIndex(index)}
                                        onClick={() => toggle(option.id)}
                                    >
                                        <span className={`mselect__check${isSelected ? " mselect__check--on" : ""}`}>
                                            {isSelected && <Icon name="check" size={12} />}
                                        </span>
                                        {option.name}
                                    </button>
                                </li>
                            );
                        })
                    )}
                </ul>
            )}
        </div>
    );
}
