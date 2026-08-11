/**
 * The languages the editor ships translations for, in the order the language
 * switcher lists them. Labels are endonyms, so they stay as they are in every
 * language.
 */
export const AVAILABLE_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' }
] as const;

export type LanguageId = (typeof AVAILABLE_LANGUAGES)[number]['id'];

/**
 * Narrows a language id the editor cannot vouch for — one from the shared
 * `preferences` cookie or from the browser — to one it has translations for.
 */
export function isAvailableLanguage(
  lang: string | null | undefined
): lang is LanguageId {
  return AVAILABLE_LANGUAGES.some((language) => language.id === lang);
}

/**
 * The most preferred browser language the editor has translations for, or `null`
 * for a browser that asks for none of them.
 *
 * The whole ordered list is considered, not just the primary language, because
 * that list is what the browser sends as `Accept-Language` — so this resolves to
 * the language the server negotiates for the pages around the editor. Region
 * subtags are dropped (`de-AT` → `de`) to match the ids above.
 */
export function negotiateBrowserLanguage(): LanguageId | null {
  // An empty list, not just a missing one: some browsers report `languages` as
  // `[]` in private mode, where the primary language is still the user's.
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
