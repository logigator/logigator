import * as z from 'zod';

/**
 * Machine-readable failure kinds. Clients branch on `code`, never on the HTTP
 * status alone or on `message`, which is human-facing and may be translated.
 * The status-mirroring codes are the fallback layer; the value is in the
 * specific ones, since several distinct failures share a status. Add a code
 * here rather than letting clients match on `message`.
 */
export const apiErrorCodeSchema = z.enum([
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'validation_failed',
  'internal',
  /** A backing service the request needs is unreachable; retrying may succeed. */
  'service_unavailable',
  /** Email or password did not match, as opposed to a missing session. */
  'invalid_credentials',
  /** The account exists but its address is unconfirmed; offer to resend the mail. */
  'email_not_verified',
  /** A one-shot mail token is unknown, already used, or expired. */
  'token_invalid',
  /** Too many attempts in the current window. */
  'rate_limited',
  /**
   * The document did not survive the format pipeline: structurally invalid, its
   * compact encodings do not decode, or it names components or option values
   * the catalog does not have. Never stored, so a stored document is always
   * readable.
   */
  'invalid_document',
  /**
   * The document claims a format version this server does not know. Distinct
   * from `invalid_document`: nothing is wrong with the document, the client is
   * ahead of the server, which during a rollout resolves itself.
   */
  'unsupported_format_version',
  /**
   * The write was against a version that is no longer current. The client
   * re-reads and decides; the server will not merge.
   */
  'version_conflict'
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/**
 * A known code, or any other string — what a client holding an older contract
 * copy receives for a code that copy predates. Intersecting with `{}` keeps the
 * known codes as completions without narrowing what is accepted.
 */
export type ApiErrorCodeOrUnknown = ApiErrorCode | (string & {});

/**
 * Reading side of {@link apiErrorCodeSchema}: every string, not the enum. An
 * enum would reject the response the first time the API adds a code, breaking
 * old clients on the very path meant to explain what went wrong — the same
 * reason response objects are `.loose()`. Clients narrow with
 * {@link isKnownApiErrorCode} and fall back to `message`.
 */
const apiErrorCodeValueSchema: z.ZodType<ApiErrorCodeOrUnknown> = z.string();

/**
 * The single error body every endpoint answers with, so clients need one
 * failure path. `details` carries per-field validation messages keyed by path.
 */
export const apiErrorSchema = z
  .object({
    code: apiErrorCodeValueSchema,
    message: z.string(),
    details: z.record(z.string(), z.array(z.string())).optional()
  })
  .loose();

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Whether `code` is one this copy of the contract knows how to branch on. */
export function isKnownApiErrorCode(
  code: ApiErrorCodeOrUnknown
): code is ApiErrorCode {
  return apiErrorCodeSchema.safeParse(code).success;
}
