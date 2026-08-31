/**
 * The languages the editor ships translations for, in switcher order. Labels
 * are endonyms, identical in every language.
 */
export const AVAILABLE_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' }
] as const;

export type LanguageId = (typeof AVAILABLE_LANGUAGES)[number]['id'];

/**
 * Narrows an unvouched language id, from the shared `preferences` cookie or the
 * browser, to one the editor has translations for.
 */
export function isAvailableLanguage(
  lang: string | null | undefined
): lang is LanguageId {
  return AVAILABLE_LANGUAGES.some((language) => language.id === lang);
}

/**
 * The most preferred browser language the editor has translations for, or
 * `null` for a browser asking for none.
 *
 * The whole ordered list is considered, since that list is what the browser
 * sends as `Accept-Language`, so this matches what the server negotiates for
 * the surrounding pages. Region subtags are dropped (`de-AT` → `de`).
 */
export function negotiateBrowserLanguage(): LanguageId | null {
  // Some browsers report `languages` as `[]` in private mode, where
  // `language` still holds the user's.
  const requested = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const tag of requested) {
    const lang = tag.split('-')[0].toLowerCase();
    if (isAvailableLanguage(lang)) {
      return lang;
    }
  }
  return null;
}
