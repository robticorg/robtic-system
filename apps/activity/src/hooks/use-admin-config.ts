import { useEffect, useState } from "react";
import type { AdminBootstrap } from "../types/admin";
import { fetchAdminConfig } from "../services/api/api-client";

type AdminBootstrapState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "ready"; data: AdminBootstrap }
    | { status: "error"; message: string };

/**
 * Loads the admin bootstrap once authentication is ready. Non-admins get `{ isAdmin: false }` —
 * used to hide the tab. `enabled` must not go true until the SDK handshake has configured the API
 * client with a token and guild id, otherwise the fetch fires before auth and fails silently.
 */
export function useAdminConfig(enabled: boolean): AdminBootstrapState {
    const [state, setState] = useState<AdminBootstrapState>({ status: "idle" });

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        setState({ status: "loading" });

        fetchAdminConfig()
            .then((data) => { if (!cancelled) setState({ status: "ready", data }); })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : String(err);
                console.error("[admin] config bootstrap failed:", message);
                if (!cancelled) setState({ status: "error", message });
            });

        return () => { cancelled = true; };
    }, [enabled]);

    return state;
}
