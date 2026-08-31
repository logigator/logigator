import { inject, Injectable, OnDestroy } from '@angular/core';
import { SignalMap } from 'ngxtension/collections';
import { LoggingService } from '../logging/logging.service';

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

@Injectable({ providedIn: 'root' })
export class CookieService implements OnDestroy {
  private readonly loggingService = inject(LoggingService);
  private readonly _hasCookieStore = 'cookieStore' in window;
  private readonly _cookies = new SignalMap<string, string>();

  private readonly _changeHandler = (e: CookieChangeEvent) =>
    this._handleChange(e);
  // Without cookieStore there are no change events, so an external change
  // (a login in another tab, session expiry) would go unnoticed until a
  // reload. Focus is the moment the user comes back from that tab.
  private readonly _focusHandler = () => {
    this._read().catch((e) => {
      this.loggingService.error(
        `Failed to re-read cookies: ${e}`,
        'CookieService'
      );
    });
  };

  constructor() {
    // `cookieStore.getAll()` is async, so a synchronous `get()` at startup
    // would miss every cookie. The async read below reconciles to the same
    // values.
    this._reconcile(this._parseDocumentCookie());
    this._read().catch((e) => {
      this.loggingService.error(
        `Failed to read cookies: ${e}`,
        'CookieService'
      );
    });

    if (this._hasCookieStore) {
      window.cookieStore.addEventListener('change', this._changeHandler);
    } else {
      window.addEventListener('focus', this._focusHandler);
    }
  }

  ngOnDestroy(): void {
    if (this._hasCookieStore) {
      window.cookieStore.removeEventListener('change', this._changeHandler);
    } else {
      window.removeEventListener('focus', this._focusHandler);
    }
  }

  get(name: string): string | null {
    return this._cookies.get(name) ?? null;
  }

  getAll(): Record<string, string> {
    return Array.from(this._cookies.entries()).reduce(
      (acc, [name, value]) => {
        acc[name] = value;
        return acc;
      },
      {} as Record<string, string>
    );
  }

  /**
   * Writes an origin-wide cookie and mirrors it into the reactive map at once,
   * so readers do not wait for a change event.
   *
   * `path=/` is what shares the cookie with the pages beside the editor: from
   * `/editor` without it the cookie is scoped to that path, shadows the
   * origin-wide one and is invisible to the rest of the site.
   *
   * The value is written raw, matching what {@link get} returns, so a caller
   * storing anything but unreserved characters encodes it itself.
   */
  set(name: string, value: string, maxAgeSeconds = ONE_YEAR_IN_SECONDS): void {
    // `cookieStore.set` is async, so the map update would race the write.
    document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}`;
    this._cookies.set(name, value);
  }

  /** Drops the cookie from the reactive map at once, as {@link set} does. */
  delete(name: string): void {
    if (this._hasCookieStore) {
      void window.cookieStore.delete(name);
    } else {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
    this._cookies.delete(name);
  }

  private async _read(): Promise<void> {
    if (!this._hasCookieStore) {
      this._reconcile(this._parseDocumentCookie());
      return;
    }
    const present: { name: string; value: string }[] = [];
    for (const { name, value } of await window.cookieStore.getAll()) {
      if (!name || !value) continue;
      present.push({ name, value });
    }
    this._reconcile(present);
  }

  /** Synchronously parses the document's non-httpOnly cookies. */
  private _parseDocumentCookie(): { name: string; value: string }[] {
    const present: { name: string; value: string }[] = [];
    for (const cookie of document.cookie.split(';')) {
      const [name, ...rest] = cookie.split('=');
      const value = rest.join('=');
      if (!name || !value) continue;
      present.push({ name: name.trim(), value: value.trim() });
    }
    return present;
  }

  private _reconcile(present: { name: string; value: string }[]): void {
    // Reconcile rather than merge: a re-read must observe deletions too, such
    // as the auth cookie cleared by a logout elsewhere.
    const names = new Set(present.map((c) => c.name));
    for (const name of [...this._cookies.keys()]) {
      if (!names.has(name)) this._cookies.delete(name);
    }
    for (const { name, value } of present) {
      this._cookies.set(name, value);
    }
  }

  private _handleChange(event: CookieChangeEvent): void {
    for (const { name, value } of event.changed) {
      if (!name || !value) return;
      this._cookies.set(name, value);
    }
    for (const { name } of event.deleted) {
      if (!name) return;
      this._cookies.delete(name);
    }
  }
}
