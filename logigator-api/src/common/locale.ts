import type { FastifyRequest } from 'fastify';
import {
  AVAILABLE_LANGUAGES,
  decodePreferences,
  DEFAULT_LANGUAGE,
  isAvailableLanguage,
  type LanguageId,
  negotiateLanguage,
  parseAcceptLanguage,
  PREFERENCES_COOKIE
} from '@logigator/core';

/**
 * The languages the origin speaks, which is also the set the mails are written
 * in. Core owns it, so a language added there is one every app on the origin
 * offers at once.
 */
export const LOCALES = AVAILABLE_LANGUAGES.map((language) => language.id);

export type Locale = LanguageId;

export const DEFAULT_LOCALE: Locale = DEFAULT_LANGUAGE;

export function resolveLocale(value: unknown): Locale {
  return typeof value === 'string' && isAvailableLanguage(value)
    ? value
    : DEFAULT_LOCALE;
}

/**
 * Which language to write to this visitor in — the API renders no pages, so
 * this is for the mails it sends. The chosen preference wins, an
 * `Accept-Language` match is the fallback, English is the floor.
 *
 * The site and the editor resolve a visitor's language by these same rules, so
 * one visitor gets one language across the origin: the pages they read and the
 * mails they get.
 */
export function localeFromRequest(request: FastifyRequest): Locale {
  const cookies = (request as { cookies?: Record<string, string | undefined> })
    .cookies;
  const chosen = decodePreferences(cookies?.[PREFERENCES_COOKIE]).lang;
  if (isAvailableLanguage(chosen)) {
    return chosen;
  }
  return (
    negotiateLanguage(
      parseAcceptLanguage(request.headers['accept-language'])
    ) ?? DEFAULT_LOCALE
  );
}
