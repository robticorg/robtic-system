import type { ApiEnvelope } from "@sdk";
import { Logger } from "@logger";

/**
 * One way to call an internal API. Base URLs come from the environment (`INVITES_API_URL`, …) —
 * Docker service names, never localhost — and every call carries the internal token and the
 * caller's request id.
 *
 * Nothing here throws anything but `InternalApiError`, so a command can catch one type and show
 * the user a calm message instead of a stack trace.
 */

export type InternalApiErrorKind =
    /** Not configured, connection refused, DNS failure. */
    | "unavailable"
    | "timeout"
    /** 4xx — the request was wrong (validation, not found, auth). */
    | "rejected"
    /** 5xx */
    | "failed"
    /** The response wasn't the envelope we expect. */
    | "malformed";

export class InternalApiError extends Error {
    constructor(
        readonly service: string,
        readonly kind: InternalApiErrorKind,
        message: string,
        readonly status: number | null = null,
        readonly code: string | null = null,
    ) {
        super(message);
        this.name = "InternalApiError";
    }
}

export interface CallOptions {
    requestId?: string;
    timeoutMs?: number;
    query?: Record<string, string | number | undefined>;
    body?: unknown;
    method?: "GET" | "POST" | "PATCH" | "DELETE";
}

export async function callInternalApi<T>(service: string, baseUrlEnv: string, path: string, options: CallOptions = {}): Promise<T> {
    const base = process.env[baseUrlEnv]?.trim().replace(/\/+$/, "");
    if (!base) throw new InternalApiError(service, "unavailable", `${baseUrlEnv} is not set`);
    const token = process.env.INTERNAL_API_TOKEN?.trim();
    if (!token) throw new InternalApiError(service, "unavailable", "INTERNAL_API_TOKEN is not set");

    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(options.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

    let response: Response;
    try {
        response = await fetch(url, {
            method: options.method ?? (options.body === undefined ? "GET" : "POST"),
            headers: {
                "x-internal-token": token,
                ...(options.requestId ? { "x-request-id": options.requestId } : {}),
                ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
            },
            body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
            signal: AbortSignal.timeout(options.timeoutMs ?? 5_000),
        });
    } catch (err) {
        const timedOut = (err as Error)?.name === "TimeoutError";
        Logger.warn(`requestId=${options.requestId ?? "-"} ${service} ${path}: ${timedOut ? "timed out" : (err as Error).message}`, "internal-client");
        throw new InternalApiError(service, timedOut ? "timeout" : "unavailable", timedOut ? "timed out" : "unreachable");
    }

    const envelope = await response.json().catch(() => null) as ApiEnvelope<T> | null;
    if (!envelope || typeof envelope !== "object" || typeof envelope.ok !== "boolean") {
        throw new InternalApiError(service, "malformed", `unexpected response (HTTP ${response.status})`, response.status);
    }
    if (envelope.ok) return envelope.data;

    const kind = response.status >= 500 ? "failed" : "rejected";
    Logger.warn(`requestId=${options.requestId ?? "-"} ${service} ${path}: ${response.status} ${envelope.error.code}`, "internal-client");
    throw new InternalApiError(service, kind, envelope.error.message, response.status, envelope.error.code);
}

/** What a Discord user sees when an internal service fails — never the internal error itself. */
export function unavailableMessage(service: string): string {
    return `The ${service} service is temporarily unavailable. Please try again in a moment.`;
}
