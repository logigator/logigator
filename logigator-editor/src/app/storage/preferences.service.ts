import { inject, Injectable } from '@angular/core';
import { CookieService } from './cookie.service';

/** The origin-wide cookie the editor and the surrounding pages both read. */
const COOKIE_NAME = 'preferences';

/** Express serializes an object cookie value as `j:` + JSON, URI-encoded. */
const JSON_PREFIX = 'j:';

/**
 * Fields of the `preferences` cookie the editor uses. Others may be present —
 * it is written by the server too — so reads and writes keep the rest intact.
 */
export interface Preferences {
  lang?: string;
  theme?: string;
  [field: string]: unknown;
}

/**
 * The user's language and theme, in the `preferences` cookie every page on the
 * origin shares, so a choice made on either side carries to the other.
 *
 * Values are validated by their consumers, not here: the cookie is
 * client-writable and the server's language and theme sets need not match the
 * editor's, so anything unrecognized falls back rather than throws.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly cookies = inject(CookieService);

  /** The whole cookie; `{}` when it is absent or unreadable. */
  public read(): Preferences {
    const raw = this.cookies.get(COOKIE_NAME);
    if (!raw) {
      return {};
    }

    try {
      // A cookie the server wrote arrives URI-encoded, one mirrored into the
      // reactive map here may not; decoding is a no-op on the latter.
      const decoded = decodeURIComponent(raw);
      if (!decoded.startsWith(JSON_PREFIX)) {
        return {};
      }
      const parsed: unknown = JSON.parse(decoded.slice(JSON_PREFIX.length));
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Preferences)
        : {};
    } catch {
      // Client-writable, so a malformed value is absorbed and consumers fall
      // back to their default.
      return {};
    }
  }

  /** One field's value, or `null` when it is absent or not a string. */
  public get(field: string): string | null {
    const value = this.read()[field];
    return typeof value === 'string' ? value : null;
  }

  /** Writes one field, leaving every other field of the cookie as it is. */
  public set(field: string, value: string): void {
    this.write({ ...this.read(), [field]: value });
  }

  /** Drops one field, leaving every other field of the cookie as it is. */
  public remove(field: string): void {
    const preferences = this.read();
    delete preferences[field];
    this.write(preferences);
  }

  private write(preferences: Preferences): void {
    this.cookies.set(
      COOKIE_NAME,
      encodeURIComponent(`${JSON_PREFIX}${JSON.stringify(preferences)}`)
    );
  }
}
