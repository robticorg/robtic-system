import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError, type ApiEnvelope } from "@sdk";
import { Logger } from "@logger";
import { isShuttingDown, onShutdown } from "./shutdown";

/**
 * The shared server for every `internal-api/*` service — the same shape as apps/minecraft-api
 * (plain Bun.serve, a route table, the `@sdk` envelope and `ApiError`), plus what internal
 * services need: a shared internal token, request ids, and graceful shutdown.
 *
 * Internal APIs are never published to the host; they are reached over the Compose network by
 * service name. The token is defence in depth on top of that.
 */

export const INTERNAL_HEADERS = {
    token: "x-internal-token",
    requestId: "x-request-id",
} as const;

export interface InternalContext {
    request: Request;
    url: URL;
    /** Capture groups of the matched path pattern, in order. */
    params: string[];
    /** Parsed JSON body (`{}` for a GET). */
    body: unknown;
    requestId: string;
}

export interface InternalRoute {
    method: "GET" | "POST" | "PATCH" | "DELETE";
    path: RegExp;
    handler: (context: InternalContext) => Promise<unknown>;
}

export function ok<T>(data: T, status = 200): Response {
    const body: ApiEnvelope<T> = { ok: true, data };
    return Response.json(body, { status });
}

export function failure(error: unknown): Response {
    const apiError = error instanceof ApiError ? error : ApiError.internal();
    const body: ApiEnvelope<never> = { ok: false, error: apiError.toJSON() };
    return Response.json(body, { status: apiError.status });
}

function sameToken(given: string, expected: string): boolean {
    const a = createHash("sha256").update(given).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
}

/** `INTERNAL_API_TOKEN` — required: an internal API refuses to start without it. */
export function internalApiToken(): string {
    const token = process.env.INTERNAL_API_TOKEN?.trim();
    if (!token) throw new Error("INTERNAL_API_TOKEN is not set — internal APIs refuse to run without it");
    return token;
}

/** Handles one request: health, auth, routing, envelope. Exported for tests (no socket needed). */
export function createInternalHandler(service: string, routes: readonly InternalRoute[], token: string) {
    return async (request: Request): Promise<Response> => {
        const started = performance.now();
        const url = new URL(request.url);
        const requestId = request.headers.get(INTERNAL_HEADERS.requestId)?.slice(0, 64) || crypto.randomUUID().slice(0, 12);

        const finish = (response: Response) => {
            response.headers.set(INTERNAL_HEADERS.requestId, requestId);
            const ms = Math.round(performance.now() - started);
            const line = `requestId=${requestId} ${request.method} ${url.pathname} → ${response.status} (${ms}ms)`;
            if (response.status >= 500) Logger.warn(line, service);
            else Logger.debug(line, service);
            return response;
        };

        if (url.pathname === "/health") {
            return finish(Response.json({ status: isShuttingDown() ? "stopping" : "ok" }, { status: isShuttingDown() ? 503 : 200 }));
        }
        if (isShuttingDown()) return finish(failure(ApiError.upstream("Service is shutting down")));

        const given = request.headers.get(INTERNAL_HEADERS.token);
        if (!given || !sameToken(given, token)) return finish(failure(ApiError.unauthorized("A valid internal token is required")));

        let methodMismatch = false;
        for (const route of routes) {
            const match = route.path.exec(url.pathname);
            if (!match) continue;
            if (route.method !== request.method) {
                methodMismatch = true;
                continue;
            }

            try {
                const body = request.method === "GET" || request.method === "DELETE"
                    ? {}
                    : await request.json().catch(() => { throw ApiError.validation({ body: "must be JSON" }); });
                const data = await route.handler({ request, url, params: match.slice(1), body, requestId });
                return finish(ok(data));
            } catch (error) {
                if (!(error instanceof ApiError)) Logger.error(`requestId=${requestId} ${request.method} ${url.pathname}: ${error}`, service);
                return finish(failure(error));
            }
        }

        return finish(methodMismatch
            ? Response.json({ ok: false, error: { code: "VALIDATION_FAILED", message: "Method not allowed" } }, { status: 405 })
            : failure(ApiError.notFound("Route")));
    };
}

/**
 * Starts an internal API. Bound to 0.0.0.0 — inside a container, loopback is unreachable from
 * other services — but never published to the host. Shuts down gracefully: stops accepting,
 * lets in-flight requests finish, then runs the caller's cleanup (Mongo, Redis).
 */
export function startInternalApi(options: {
    service: string;
    port: number;
    routes: readonly InternalRoute[];
    onStop?: () => Promise<void>;
}) {
    const handler = createInternalHandler(options.service, options.routes, internalApiToken());
    const server = Bun.serve({ hostname: "0.0.0.0", port: options.port, fetch: handler });

    onShutdown(`${options.service} http`, () => server.stop(false));
    if (options.onStop) onShutdown(`${options.service} resources`, options.onStop);

    Logger.success(`${options.service} listening on :${options.port}`, options.service);
    return server;
}
