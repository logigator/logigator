import { z } from 'zod';

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
  'internal'
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
