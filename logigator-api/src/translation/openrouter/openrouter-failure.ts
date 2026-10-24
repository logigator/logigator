import type { TranslationFailure } from '../translator';

/**
 * The parts of an OpenRouter error body the classification reads. The body is
 * `{ error: { code, message, metadata } }`, with the HTTP status repeated as
 * `code` — which is what makes a `200` carrying only an error classifiable at
 * all.
 */
interface OpenRouterError {
  code: unknown;
  message: string | null;
  metadata: Record<string, unknown> | null;
  type: unknown;
}

export function readOpenRouterError(body: unknown): OpenRouterError | null {
  const error = (body as { error?: unknown } | null | undefined)?.error;
  if (typeof error !== 'object' || error === null) return null;

  const { code, message, metadata, type } = error as Record<string, unknown>;
  return {
    code,
    message: typeof message === 'string' ? message : null,
    metadata:
      typeof metadata === 'object' && metadata !== null
        ? (metadata as Record<string, unknown>)
        : null,
    type
  };
}

/** The `error_type` a provider or a guardrail attached, wherever it was put. */
function errorType(error: OpenRouterError | null): unknown {
  return error?.metadata?.['error_type'] ?? error?.type;
}

/**
 * Whether a `403` is the moderation layer or the model refusing this text,
 * rather than a guardrail refusing the key. Moderation names its `reasons`.
 */
function refusesTheText(error: OpenRouterError | null): boolean {
  const type = errorType(error);
  return (
    Array.isArray(error?.metadata?.['reasons']) ||
    type === 'content_policy_violation' ||
    type === 'refusal'
  );
}

/**
 * Classifies a failed call by its status — the HTTP status, or the `code` of an
 * error that came back inside a `200`.
 *
 * Statuses the table does not name fall by their class: another 5xx is the
 * route failing, so transient; another 4xx is a request the server will refuse
 * again unchanged, and the request is fixed in code, so it is the
 * configuration that has to change.
 *
 * The reason carries OpenRouter's message and never its metadata, which is
 * where a moderation error quotes the flagged input.
 */
export function classifyOpenRouterFailure(
  status: number,
  body: unknown,
  retryAfterSeconds: number | null
): TranslationFailure {
  const error = readOpenRouterError(body);
  const reason = `OpenRouter answered ${status}${error?.message ? `: ${error.message.slice(0, 300)}` : ''}`;

  switch (status) {
    case 402:
      return { kind: 'system', pause: 'budget', reason };
    case 403:
      return refusesTheText(error)
        ? { kind: 'document', reason }
        : { kind: 'system', pause: 'budget', reason };
    case 408:
    case 429:
    case 500:
    case 502:
    case 504:
      return { kind: 'transient', reason, retryAfterSeconds };
    case 503:
      // An overloaded provider passes; "no provider meets your routing
      // requirements" is the preset and stays until somebody changes it.
      return errorType(error) === 'provider_overloaded'
        ? { kind: 'transient', reason, retryAfterSeconds }
        : { kind: 'system', pause: 'configuration', reason };
    case 400:
    case 401:
      return { kind: 'system', pause: 'configuration', reason };
  }

  return status >= 500
    ? { kind: 'transient', reason, retryAfterSeconds }
    : { kind: 'system', pause: 'configuration', reason };
}

/**
 * `Retry-After` in seconds, from either of its forms: a delay, or an HTTP date.
 * Absent or unreadable is null, which leaves the backoff to the caller.
 */
export function parseRetryAfter(
  header: string | null,
  now = Date.now()
): number | null {
  if (header === null || header.trim() === '') return null;

  const trimmed = header.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  const at = Date.parse(trimmed);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
}
