import type { ApiErrorCode, ApiErrorCodeOrUnknown } from './api-error.contract';

/**
 * A failure the API described in its own error body. Every endpoint answers
 * failures with one shape, so one error type covers every client. Callers
 * branch on {@link ApiRequestError.code} rather than the status: several
 * failures share a status, and the message is human-facing.
 *
 * The classes live beside the schemas because the error body is contract
 * surface, while turning a given transport's failure into one of them is not —
 * that adapter belongs to whichever HTTP client raised it.
 */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCodeOrUnknown,
    message: string,
    readonly details?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * A response whose body is not what the contract describes. Distinct from
 * {@link ApiRequestError}: nothing about the request was wrong, the two sides
 * disagree about a shape, which is deploy skew or a bug.
 */
export class InvalidResponseError extends Error {
  constructor(path: string, detail: string) {
    super(`Unexpected response from ${path}: ${detail}`);
    this.name = 'InvalidResponseError';
  }
}

/** Whether `err` is an API failure the server labelled `code`. */
export function isApiError(err: unknown, code: ApiErrorCode): boolean {
  return err instanceof ApiRequestError && err.code === code;
}
