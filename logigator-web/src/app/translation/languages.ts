/**
 * The languages the site ships translations for, in switcher order. Labels are
 * endonyms, identical in every language.
 *
 * The set matches the editor's, because the choice is carried between them in
 * the origin-wide `preferences` cookie: a language one side cannot render is a
 * preference the other silently drops.
 */
export const AVAILABLE_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' }
] as const;

export type LanguageId = (typeof AVAILABLE_LANGUAGES)[number]['id'];

/** The language every URL without a usable preference resolves to. */
export const DEFAULT_LANGUAGE: LanguageId = 'en';

/** Narrows an unvouched language id — a URL segment, a cookie field, a header. */
export function isAvailableLanguage(
  lang: string | null | undefined
): lang is LanguageId {
  return AVAILABLE_LANGUAGES.some((language) => language.id === lang);
}

/**
 * The first language of an ordered preference list the site can render, or
 * `null` for a list naming none. Region subtags are dropped (`de-AT` → `de`).
 */
export function negotiateLanguage(
  requested: readonly string[]
): LanguageId | null {
  for (const tag of requested) {
    const lang = tag.split('-')[0].toLowerCase();
    if (isAvailableLanguage(lang)) {
      return lang;
    }
  }
  return null;
}

/**
 * The languages an `Accept-Language` header asks for, most preferred first.
 *
 * Quality values are honoured, since a browser configured with a secondary
 * language sends it at a lower `q` rather than in list order. `*` is dropped:
 * it means "anything", which is what falling through to the default already is.
 */
export function parseAcceptLanguage(header: string | null): string[] {
  if (!header) {
    return [];
  }
  return header
    .split(',')
    .map((part) => {
      const [tag, ...parameters] = part.trim().split(';');
      const quality = parameters
        .map((parameter) => /^\s*q=([0-9.]+)\s*$/.exec(parameter))
        .find(Boolean);
      return { tag: tag.trim(), quality: quality ? Number(quality[1]) : 1 };
    })
    .filter((entry) => entry.tag && entry.tag !== '*' && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality)
    .map((entry) => entry.tag);
}
