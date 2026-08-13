import { HttpException } from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@logigator/contract';

/**
 * An error that names its own {@link ApiErrorCode} instead of leaving it to be
 * derived from the HTTP status.
 *
 * The status-derived codes are only a fallback layer — one code per status
 * carries nothing a client cannot read off the response itself. A code earns
 * its place by being finer-grained than the status: several distinct failures
 * share `409`, and a client that has to tell them apart would otherwise be
 * matching on `message`, which is human-facing and translated. So endpoints
 * throw this with a specific code as those cases appear, and the enum in
 * `@logigator/contract` grows with them.
 */
export class ApiException extends HttpException {
  constructor(
    status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: ApiError['details']
  ) {
    super(message, status);
  }
}
