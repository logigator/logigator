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

/**
 * The languages an `Accept-Language` header asks for, most preferred first.
 *
 * Quality values are honoured, since a browser configured with a secondary
 * language sends it at a lower `q` rather than in list order. `*` is dropped:
 * it means "anything", which is what falling through to the default already is.
 *
 * The site reads the header by these same rules, so one visitor gets one
 * language across the origin — the pages they read and the mails they get.
 */
function parseAcceptLanguage(header: string | undefined): string[] {
  if (!header) return [];
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

/**
 * The first supported language named in an `Accept-Language` header.
 *
 * A tag is cut at its region subtag rather than at two characters, so a
 * three-letter language stays itself instead of becoming a two-letter one that
 * means something else.
 */
function localeFromAcceptLanguage(header: string | undefined): Locale | null {
  for (const tag of parseAcceptLanguage(header)) {
    const lang = tag.split('-')[0].toLowerCase();
    if (LOCALES.includes(lang as Locale)) return lang as Locale;
  }
  return null;
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
