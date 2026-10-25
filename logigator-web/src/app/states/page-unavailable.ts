import { Directive, inject } from '@angular/core';
import { ResponseStatus } from '../seo/response-status';

/**
 * Marks the error drawn where the read a page exists to show failed. A server
 * render that draws it answers 503 with `Retry-After`; a section the page can
 * do without stays unmarked, and its page a 200.
 */
@Directive({ selector: '[webPageUnavailable]' })
export class PageUnavailable {
  constructor() {
    inject(ResponseStatus).unavailable();
  }
}
