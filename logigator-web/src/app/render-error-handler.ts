import {
  ErrorHandler,
  inject,
  Injectable,
  REQUEST,
  REQUEST_CONTEXT
} from '@angular/core';
import { renderRequestId } from '../render-context';
import { logRenderError } from '../server-log';

/**
 * The server's `ErrorHandler`. Angular's default writes what it catches to the
 * console as text; this writes it as a line of the server's log, under the id
 * the request's other lines and its API calls carry.
 */
@Injectable()
export class RenderErrorHandler implements ErrorHandler {
  private readonly request = inject(REQUEST, { optional: true });
  private readonly requestId = renderRequestId(
    inject(REQUEST_CONTEXT, { optional: true })
  );

  handleError(error: unknown): void {
    const url = this.request ? new URL(this.request.url) : null;
    logRenderError(
      error,
      this.request && url
        ? {
            reqId: this.requestId,
            method: this.request.method,
            url: url.pathname + url.search
          }
        : null
    );
  }
}
