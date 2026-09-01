import { inject, Injectable, PLATFORM_ID, REQUEST } from '@angular/core';
import { DOCUMENT, isPlatformServer } from '@angular/common';
import { parseCookieHeader } from '@logigator/core';

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * The document's cookies, readable from both platforms: on the server they come
 * off the incoming request's `Cookie` header, in the browser off
 * `document.cookie`. That symmetry is what lets a service read the language and
 * theme the same way in a server render and after hydration.
 *
 * Writing is browser-only. A server render answers a request already made, so
 * the only preference it could set is one the user did not choose on this page
 * view; every write here follows a click.
 */
@Injectable({ providedIn: 'root' })
export class CookieService {
  private readonly document = inject(DOCUMENT);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly request = inject(REQUEST, { optional: true });

  /** The raw, still-encoded value, or `null` when the cookie is absent. */
  public get(name: string): string | null {
    return parseCookieHeader(this.header())[name] ?? null;
  }

  /**
   * Writes an origin-wide cookie. `path=/` is what shares it with the editor
   * and the API: written from a nested path it would be scoped there, shadow
   * the origin-wide one and be invisible to the rest of the site.
   *
   * The value is written raw, matching what {@link get} returns, so a caller
   * storing anything but unreserved characters encodes it itself.
   */
  public set(
    name: string,
    value: string,
    maxAgeSeconds = ONE_YEAR_IN_SECONDS
  ): void {
    if (this.isServer) {
      return;
    }
    this.document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}`;
  }

  public delete(name: string): void {
    if (this.isServer) {
      return;
    }
    this.document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  }

  private header(): string {
    return this.isServer
      ? (this.request?.headers.get('cookie') ?? '')
      : this.document.cookie;
  }
}
