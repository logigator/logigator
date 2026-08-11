import { inject } from '@angular/core';
import { GetLangParams, PersistStorage } from '@jsverse/transloco-persist-lang';
import { PreferencesService } from '../storage/preferences.service';
import { isAvailableLanguage, negotiateBrowserLanguage } from './languages';

/**
 * Backs transloco's persisted language with the origin-wide `preferences`
 * cookie, so the editor and the surrounding pages read and write one language.
 * `key` is the cookie field (`storageKey` where this is provided).
 */
export function preferencesLangStorage(): PersistStorage {
  const preferences = inject(PreferencesService);
  return {
    getItem: (key) => {
      const lang = preferences.get(key);
      // The cookie is client-writable and the server's language set need not
      // match the editor's, so an unrecognized value is treated as no value —
      // {@link resolveStartupLang} then falls back.
      return isAvailableLanguage(lang) ? lang : null;
    },
    setItem: (key, value) => preferences.set(key, value),
    removeItem: (key) => preferences.remove(key)
  };
}

/**
 * Picks the language the editor starts in.
 *
 * `cachedLang` is the shared cookie's language, already validated by
 * {@link preferencesLangStorage}. The browser language covers the case where
 * there is no cookie yet — the static editor bundle is served before the
 * middleware that writes it, so a visitor whose first request is `/editor/`
 * arrives without one. It is negotiated over the browser's whole language list
 * rather than taken from `browserLang`, which carries only the primary one, so
 * that such a visitor sees the language the server will pick for the pages around
 * the editor once it does write the cookie.
 */
export function resolveStartupLang({
  cachedLang,
  defaultLang
}: GetLangParams): string {
  return cachedLang ?? negotiateBrowserLanguage() ?? defaultLang;
}
