import { inject } from '@angular/core';
import { GetLangParams, PersistStorage } from '@jsverse/transloco-persist-lang';
import { PreferencesService } from '../storage/preferences.service';
import { isAvailableLanguage, negotiateBrowserLanguage } from './languages';

/**
 * Backs transloco's persisted language with the origin-wide `preferences`
 * cookie, so the editor and the surrounding pages share one language. `key` is
 * the cookie field.
 */
export function preferencesLangStorage(): PersistStorage {
  const preferences = inject(PreferencesService);
  return {
    getItem: (key) => {
      const lang = preferences.get(key);
      // The cookie is client-writable and the server's language set need not
      // match the editor's, so an unrecognized value counts as no value and
      // {@link resolveStartupLang} falls back.
      return isAvailableLanguage(lang) ? lang : null;
    },
    setItem: (key, value) => preferences.set(key, value),
    removeItem: (key) => preferences.remove(key)
  };
}

/**
 * Picks the language the editor starts in. `cachedLang` is the shared cookie's
 * language, validated by {@link preferencesLangStorage}.
 *
 * The browser language covers a visitor with no cookie yet: the static bundle
 * is served before the middleware that writes it. Negotiating over the whole
 * language list rather than `browserLang`'s primary one makes that visitor see
 * the language the server will pick for the surrounding pages.
 */
export function resolveStartupLang({
  cachedLang,
  defaultLang
}: GetLangParams): string {
  return cachedLang ?? negotiateBrowserLanguage() ?? defaultLang;
}
