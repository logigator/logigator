import { HttpErrorResponse } from '@angular/common/http';
import {
  apiErrorSchema,
  type ApiErrorCode,
  type ApiErrorCodeOrUnknown
} from '@logigator/contract';

/**
 * A failure the API described in its own error body.
 *
 * Every endpoint answers failures with one shape (`{ code, message, details }`),
 * so the whole client needs one error type and one place that recognizes it.
 * Callers branch on {@link code} rather than on the status: several distinct
 * failures share a status, and the message is human-facing and may be
 * translated.
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
 * A response whose body is not what the contract describes.
 *
 * Distinct from {@link ApiRequestError} because nothing about the request was
 * wrong: the server and this client disagree about a shape, which is a deploy
 * skew or a bug rather than something a user can act on.
 */
export class InvalidResponseError extends Error {
  constructor(path: string, detail: string) {
    super(`Unexpected response from ${path}: ${detail}`);
    this.name = 'InvalidResponseError';
  }
}

/**
 * Reads a transport failure as the API's own error body, falling back to the
 * status when the body is not one — a proxy's HTML error page, a network
 * failure, an offline browser.
 */
export function toApiRequestError(err: HttpErrorResponse): ApiRequestError {
  const parsed = apiErrorSchema.safeParse(err.error);
  if (parsed.success) {
    return new ApiRequestError(
      err.status,
      parsed.data.code,
      parsed.data.message,
      parsed.data.details
    );
  }
  return new ApiRequestError(
    err.status,
    err.status === 0 ? 'network_error' : 'internal',
    `HTTP ${err.status} ${err.statusText}`
  );
}

/** Whether `err` is an API failure the server labelled `code`. */
export function isApiError(err: unknown, code: ApiErrorCode): boolean {
  return err instanceof ApiRequestError && err.code === code;
}
