import { useEffect, useState } from "react";
import type { SearchResult } from "../types/profile";
import { searchUsers } from "../services/api/api-client";

const DEBOUNCE_MS = 220;
const MIN_QUERY_LENGTH = 1;

interface UserSearchState {
    results: SearchResult[];
    loading: boolean;
}

/** Debounced search. Stale responses are discarded so fast typing can't render an older result set. */
export function useUserSearch(query: string): UserSearchState {
    const [state, setState] = useState<UserSearchState>({ results: [], loading: false });

    useEffect(() => {
        const trimmed = query.trim();
        if (trimmed.length < MIN_QUERY_LENGTH) {
            setState({ results: [], loading: false });
            return;
        }

        let cancelled = false;
        setState((prev) => ({ ...prev, loading: true }));

        const timer = setTimeout(() => {
            searchUsers(trimmed)
                .then((results) => { if (!cancelled) setState({ results, loading: false }); })
                .catch(() => { if (!cancelled) setState({ results: [], loading: false }); });
        }, DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query]);

    return state;
}
