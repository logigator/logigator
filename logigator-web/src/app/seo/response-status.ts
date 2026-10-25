import { inject, Injectable, RESPONSE_INIT } from '@angular/core';

/**
 * How long a crawler is asked to wait before fetching a page whose read
 * failed: a restart or a migration is over within minutes.
 */
const RETRY_AFTER_SECONDS = 300;

/**
 * Sets the status a server-rendered page answers with. Angular hands the
 * server render a mutable `RESPONSE_INIT`, which is the only way a component
 * reached through routing can influence the status line — without it a page
 * saying "not found" or "try again" would answer 200 and be indexed as such.
 *
 * In the browser there is no response to set, so both do nothing.
 */
@Injectable({ providedIn: 'root' })
export class ResponseStatus {
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  /** The URL names nothing: a crawler drops it. */
  public notFound(): void {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }
  }

  /**
   * The read the page exists to show failed: a crawler keeps what it has
   * indexed and comes back, rather than indexing the error in its place.
   */
  public unavailable(): void {
    if (!this.responseInit) return;
    this.responseInit.status = 503;
    const headers =
      this.responseInit.headers instanceof Headers
        ? this.responseInit.headers
        : new Headers(this.responseInit.headers);
    headers.set('retry-after', String(RETRY_AFTER_SECONDS));
    this.responseInit.headers = headers;
  }
}
