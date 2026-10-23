import type { ApiErrorCode } from "../errors/error-codes";

/**
 * Every Robtic API response uses this envelope. A client can therefore branch on `ok` before it
 * knows anything else about the route, which is what lets the SDK client have one response path.
 */
export type ApiEnvelope<T> =
    | { ok: true; data: T }
    | { ok: false; error: { code: ApiErrorCode; message: string; details?: Record<string, string> } };
