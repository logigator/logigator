import type { FastifyRequest } from 'fastify';

/** The languages the site is translated into. */
export const LOCALES = ['en', 'de', 'es', 'fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function resolveLocale(value: unknown): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

/**
 * The `preferences` cookie the whole origin shares (language and theme). The
 * landing app writes it as `j:` + JSON, URI-encoded — Express' object-cookie
 * format. It is client-writable, so anything unreadable is absorbed.
 */
function localeFromPreferencesCookie(raw: string | undefined): Locale | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('j:')) return null;
    const parsed: unknown = JSON.parse(decoded.slice(2));
    const lang =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { lang?: unknown }).lang
        : undefined;
    return LOCALES.includes(lang as Locale) ? (lang as Locale) : null;
  } catch {
    return null;
  }
}

/** The first supported language named in an `Accept-Language` header. */
function localeFromAcceptLanguage(header: string | undefined): Locale | null {
  if (!header) return null;
  const accepted = header
    .split(',')
    .map((part) => part.split(';')[0].trim().toLowerCase().slice(0, 2));
  return (
    accepted.find((tag): tag is Locale => LOCALES.includes(tag as Locale)) ??
    null
  );
}

/**
 * Which language to write to this visitor in — the API renders no pages, so
 * this is for the mails it sends. The chosen preference wins, an
 * `Accept-Language` match is the fallback, English is the floor.
 */
export function localeFromRequest(request: FastifyRequest): Locale {
  const cookies = (request as { cookies?: Record<string, string | undefined> })
    .cookies;
  return (
    localeFromPreferencesCookie(cookies?.['preferences']) ??
    localeFromAcceptLanguage(request.headers['accept-language']) ??
    DEFAULT_LOCALE
  );
}
