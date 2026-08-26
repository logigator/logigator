import * as z from 'zod';

/**
 * Machine-readable failure kinds. Clients branch on `code`, never on the HTTP
 * status alone or on `message` (which is human-facing and may be translated).
 *
 * The codes below mirror the statuses one for one and are only the fallback
 * layer — on their own they tell a client nothing it cannot read off the
 * response. The value is in the codes that come later: several distinct
 * failures share `409`, and telling them apart is what this field is for. Add a
 * specific code here as each such case ships rather than letting clients match
 * on `message`.
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
  /** Email or password did not match — as opposed to `unauthorized`, which is a missing session. */
  'invalid_credentials',
  /** The account exists but its address is unconfirmed; offer to resend the mail. */
  'email_not_verified',
  /** A one-shot mail token is unknown, already used, or expired. */
  'token_invalid',
  /** Too many attempts in the current window. */
  'rate_limited',
  /**
   * The document did not survive the format pipeline: it is structurally
   * invalid, its compact encodings do not decode, or it names components or
   * option values the catalog does not have. Never stored — the whole point of
   * parsing on write is that what is in the column is always readable.
   */
  'invalid_document',
  /**
   * The document claims a format version this server does not know. Distinct
   * from `invalid_document` because it is the one document rejection that says
   * nothing is wrong with the document: the client is ahead of the server, which
   * during a rollout is a matter of waiting rather than of fixing anything.
   */
  'unsupported_format_version',
  /**
   * The write was against a version that is no longer current — something else
   * saved in between. The client re-reads and decides; the server will not merge.
   */
  'version_conflict'
]);

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;

/**
 * A known code, or any other string.
 *
 * The `string` arm is what a client holding an older contract copy receives
 * once the API starts sending a code that copy predates. Intersecting with `{}`
 * keeps the known codes as completions and keeps a `switch` over them
 * meaningful; it does not narrow what is accepted.
 */
export type ApiErrorCodeOrUnknown = ApiErrorCode | (string & {});

/**
 * Reading side of {@link apiErrorCodeSchema}: deliberately every string, not
 * the enum.
 *
 * An enum here would reject the response outright the first time the API adds a
 * code, turning every new failure kind into a coordinated deploy and breaking
 * old clients on exactly the path meant to explain what went wrong — the same
 * reason the response objects are `.loose()`. Clients narrow with
 * {@link isKnownApiErrorCode} and fall back to showing `message` (or a generic
 * "unknown error") when it says no.
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
