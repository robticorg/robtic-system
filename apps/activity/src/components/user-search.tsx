import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "../types/profile";
import { useUserSearch } from "../hooks/use-user-search";
import { Avatar } from "./avatar";
import { Icon } from "./icon";

interface UserSearchProps {
    onSelect: (result: SearchResult) => void;
    placeholder?: string;
}

export function UserSearch({ onSelect, placeholder }: UserSearchProps) {
    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const { results, loading } = useUserSearch(query);

    useEffect(() => setActiveIndex(0), [results]);

    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener("pointerdown", onPointerDown);
        return () => document.removeEventListener("pointerdown", onPointerDown);
    }, []);

    function choose(result: SearchResult) {
        onSelect(result);
        setQuery("");
        setOpen(false);
    }

    function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === "Escape") {
            setOpen(false);
            return;
        }
        if (!results.length) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((i) => (i + 1) % results.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((i) => (i - 1 + results.length) % results.length);
        } else if (event.key === "Enter") {
            event.preventDefault();
            const picked = results[activeIndex];
            if (picked) choose(picked);
        }
    }

    const showDropdown = open && query.trim().length > 0;

    return (
        <div className="search" ref={containerRef}>
            <Icon name="search" size={16} className="search__icon" />
            <input
                className="search__input"
                type="text"
                value={query}
                placeholder={placeholder ?? "Search a member…"}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls="user-search-results"
                aria-autocomplete="list"
            />

            {showDropdown && (
                <ul className="search__results" id="user-search-results" role="listbox">
                    {results.map((result, index) => (
                        <li key={result.discordId} role="option" aria-selected={index === activeIndex}>
                            <button
                                type="button"
                                className="search__option"
                                data-active={index === activeIndex}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => choose(result)}
                            >
                                <Avatar src={result.avatarUrl} name={result.displayName} seed={result.discordId} size={28} />
                                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {result.displayName}
                                </span>
                                <span className="muted">Lv {result.level}</span>
                            </button>
                        </li>
                    ))}

                    {results.length === 0 && (
                        <li className="search__empty">{loading ? "Searching…" : "No members found"}</li>
                    )}
                </ul>
            )}
        </div>
    );
}
