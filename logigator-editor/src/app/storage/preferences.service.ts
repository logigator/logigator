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
    return decodePreferences(this.cookies.get(PREFERENCES_COOKIE));
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
    this.cookies.set(PREFERENCES_COOKIE, encodePreferences(preferences));
  }
}
