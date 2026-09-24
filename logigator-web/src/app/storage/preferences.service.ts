import { inject, Injectable } from '@angular/core';
import {
  decodePreferences,
  encodePreferences,
  Preferences,
  PREFERENCES_COOKIE
} from '@logigator/core';
import { CookieService } from './cookie.service';

/**
 * The user's language and theme, in the `preferences` cookie every page on the
 * origin shares, so a choice made here is the one the editor opens with — and,
 * until the cutover, the one the legacy backend's pages read.
 *
 * Values are validated by their consumers, not here: the cookie is
 * client-writable and the language and theme sets need not match across the
 * origin, so anything unrecognized falls back rather than throws.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly cookies = inject(CookieService);

  /** The whole cookie; `{}` when it is absent or unreadable. */
  public read(): Preferences {
    return decodePreferences(this.cookies.get(PREFERENCES_COOKIE));
  }

  /** One field's value, or `null` when it is absent or not a string. */
  public get(field: string): string | null {
    const value = this.read()[field];
    return typeof value === 'string' ? value : null;
  }

  /** Writes one field, leaving every other field of the cookie as it is. */
  public set(field: string, value: string): void {
    this.cookies.set(
      PREFERENCES_COOKIE,
      encodePreferences({ ...this.read(), [field]: value })
    );
  }
}
