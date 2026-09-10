import { inject, Injectable, RESPONSE_INIT } from '@angular/core';

/**
 * Sets the response status a rendered 404 page must carry. Angular hands the
 * server render a mutable `RESPONSE_INIT`, which is the only way a component
 * reached through routing can influence the status line — and without it every
 * missing URL would answer 200 with a page saying otherwise.
 *
 * In the browser there is no response to set, so this does nothing.
 */
@Injectable({ providedIn: 'root' })
export class NotFoundStatus {
  private readonly responseInit = inject(RESPONSE_INIT, { optional: true });

  public mark(): void {
    if (this.responseInit) {
      this.responseInit.status = 404;
    }
  }
}
