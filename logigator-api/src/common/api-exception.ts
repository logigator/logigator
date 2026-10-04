import { HttpException } from '@nestjs/common';
import type { ApiError, ApiErrorCode } from '@logigator/contract';

/**
 * An error that names its own {@link ApiErrorCode} rather than leaving it to be
 * derived from the HTTP status. A code earns its place by being finer-grained
 * than the status: several distinct failures share `409`, and a client telling
 * them apart would otherwise match on `message`, which is translated.
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
