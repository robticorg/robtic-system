/**
 * Server-safe entry point: the API contract only.
 *
 * `index.ts` additionally re-exports the Discord Embedded App layer, which pulls in a
 * browser-only dependency. Server applications — `apps/bot`, `internal-api/*` — import from here
 * (the `@sdk` alias) so that dependency never reaches a Bun process.
 */

export { ApiError } from "./errors/api-error";
export {
    API_ERROR_CODES,
    API_ERROR_STATUS,
    RETRYABLE_ERROR_CODES,
    isRetryableCode,
    type ApiErrorCode,
} from "./errors/error-codes";

export type * from "./dto/common";
