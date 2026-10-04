import { LanguageId, negotiateLanguage } from '@logigator/core';

/**
 * The most preferred browser language the editor has translations for, or
 * `null` for a browser asking for none.
 *
 * The whole ordered list is considered, since that list is what the browser
 * sends as `Accept-Language`, so this matches what the server negotiates for
 * the surrounding pages.
 */
export function negotiateBrowserLanguage(): LanguageId | null {
  // Some browsers report `languages` as `[]` in private mode, where
  // `language` still holds the user's.
  const requested = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  return negotiateLanguage(requested);
}
