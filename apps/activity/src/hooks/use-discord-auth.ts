import { useEffect, useState } from "react";
import type { DiscordAuth } from "@robtic/sdk";
import { setupDiscordSdk } from "../services/discord/setup-discord-sdk";

export type DiscordAuthState =
    | { status: "connecting" }
    | { status: "authenticated"; auth: DiscordAuth }
    | { status: "error"; message: string };

export function useDiscordAuth(): DiscordAuthState {
    const [state, setState] = useState<DiscordAuthState>({ status: "connecting" });

    useEffect(() => {
        let cancelled = false;

        setupDiscordSdk()
            .then((auth) => {
                if (!cancelled) setState({ status: "authenticated", auth });
            })
            .catch((err: unknown) => {
                if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}
