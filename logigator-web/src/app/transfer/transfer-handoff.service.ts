import {
  inject,
  Injectable,
  PLATFORM_ID,
  StateKey,
  TransferState
} from '@angular/core';
import { isPlatformServer } from '@angular/common';

/**
 * The explicit server → browser hand-off for data a page resolves during its
 * server render. Angular's HTTP transfer cache cannot carry these reads: it
 * skips any request `apiOriginInterceptor` has put the visitor's cookie on,
 * and it keys on the URL after the rewrite onto the API's own origin — so
 * whatever must cross the boundary does so under a named `TransferState` key,
 * and this service is the one place that pattern lives. Without the hand-off a
 * page still works, it just repeats the render's request after hydration —
 * invisible everywhere but the API logs, which is what makes it worth
 * routing every SSR-resolved read through here.
 *
 * The hand-off is consume-once: the browser reads a transferred value out of
 * the document exactly once, so resolving the same key again asks the source
 * rather than replaying an answer from page load.
 */
@Injectable({ providedIn: 'root' })
export class TransferHandoffService {
  private readonly state = inject(TransferState);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));

  /**
   * Returns the value the server render left under `key`, consuming it — or,
   * when there is none, the result of `fetch`, which a server render also
   * writes under `key` for the browser to pick up.
   *
   * A rejected `fetch` transfers nothing, so the browser repeats it after
   * hydration; a fetch whose failure must cross the boundary too has to
   * resolve to a value (`null`, say) instead of throwing.
   */
  public async resolve<T>(
    key: StateKey<T>,
    fetch: () => Promise<T>
  ): Promise<T> {
    if (this.state.hasKey(key)) {
      // `hasKey` guarantees a stored value, so the default is never read.
      const value = this.state.get(key, undefined as never);
      // Consuming is a browser affair: on the server the value has to stay
      // put until the document serializes, so a render resolving the same key
      // twice reads its own answer without unpublishing it.
      if (!this.isServer) {
        this.state.remove(key);
      }
      return value;
    }

    const value = await fetch();
    if (this.isServer) {
      this.state.set(key, value);
    }
    return value;
  }
}
