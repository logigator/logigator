import { HttpErrorResponse } from '@angular/common/http';
import { ApiRequestError, apiErrorSchema } from '@logigator/contract';

/**
 * Reads a transport failure as the API's own error body, falling back to the
 * status for a proxy's HTML error page or an offline browser.
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
