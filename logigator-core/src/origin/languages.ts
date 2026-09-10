/**
 * The languages the origin speaks, in switcher order. Labels are endonyms,
 * identical in every language, so they are data rather than translations.
 *
 * One set for the whole origin: the choice travels between the apps in the
 * `preferences` cookie, and a language one of them cannot render is a
 * preference the others silently drop.
 */
export const AVAILABLE_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'fr', label: 'Français' },
  { id: 'es', label: 'Español' }
] as const;

export type LanguageId = (typeof AVAILABLE_LANGUAGES)[number]['id'];

/** The language anything without a usable preference resolves to. */
export const DEFAULT_LANGUAGE: LanguageId = 'en';

/** Narrows an unvouched language id — a URL segment, a cookie field, a header. */
export function isAvailableLanguage(
  lang: string | null | undefined
): lang is LanguageId {
  return AVAILABLE_LANGUAGES.some((language) => language.id === lang);
}

/**
 * The first language of an ordered preference list the origin can render, or
 * `null` for a list naming none.
 *
 * A tag is cut at its region subtag rather than after two characters, so a
 * three-letter language stays itself instead of becoming a two-letter one that
 * means something else (`frr`, Northern Frisian, is not `fr`).
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
export function parseAcceptLanguage(
  header: string | null | undefined
): string[] {
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
