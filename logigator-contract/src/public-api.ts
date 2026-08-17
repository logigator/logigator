/**
 * Public surface of `@logigator/contract` — the API contract as zod schemas.
 *
 * The server validates incoming requests with these schemas; the editor and
 * `logigator-web` build typed clients from the inferred types. There is no
 * codegen step, so a contract change breaks every consumer at type-check time.
 * An OpenAPI document can be derived from these schemas later if third-party
 * consumers ever need one — never authored as a second source of truth.
 *
 * Layering: the contract may import `@logigator/core` (the document format it
 * carries), never the server. Response object schemas are deliberately loose,
 * so a client holding an older contract copy tolerates fields the API added
 * instead of rejecting the response or silently stripping them.
 */
export {
  apiErrorCodeSchema,
  apiErrorSchema,
  isKnownApiErrorCode,
  type ApiError,
  type ApiErrorCode,
  type ApiErrorCodeOrUnknown
} from './error/api-error.contract';
export { metaResponseSchema, type MetaResponse } from './meta/meta.contract';
export {
  healthCheckSchema,
  readinessResponseSchema,
  type HealthCheck,
  type ReadinessResponse
} from './health/health.contract';
