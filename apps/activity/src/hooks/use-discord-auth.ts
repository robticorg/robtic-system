import { useEffect, useState } from "react";
import type { DiscordSession } from "@robtic/sdk";
import { setupDiscordSdk } from "../services/discord/setup-discord-sdk";

/** SDK RPC failures reject with plain objects ({code, message}), not Error instances. */
function describeError(err: unknown): string {
    if (err instanceof Error) return err.message;
    try {
        return JSON.stringify(err);
    } catch {
        return String(err);
    }
}

export type DiscordAuthState =
    | { status: "connecting" }
    | { status: "authenticated"; session: DiscordSession }
    | { status: "error"; message: string };

export function useDiscordAuth(): DiscordAuthState {
    const [state, setState] = useState<DiscordAuthState>({ status: "connecting" });

    useEffect(() => {
        let cancelled = false;

        setupDiscordSdk()
            .then((session) => {
                if (!cancelled) setState({ status: "authenticated", session });
            })
            .catch((err: unknown) => {
                if (!cancelled) setState({ status: "error", message: describeError(err) });
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
}
