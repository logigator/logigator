import {
  decodePreferences,
  parseCookieHeader,
  PREFERENCES_COOKIE
} from '../storage/preferences-cookie';
import {
  DEFAULT_LANGUAGE,
  isAvailableLanguage,
  LanguageId,
  negotiateLanguage,
  parseAcceptLanguage
} from './languages';

/** The headers language negotiation reads; a subset of a real request's. */
export interface NegotiationHeaders {
  cookie?: string;
  acceptLanguage?: string;
}

/**
 * The language an unprefixed URL should be answered in: the shared
 * `preferences` cookie first, then `Accept-Language`, then the default.
 *
 * Same order the legacy default-preferences middleware used, and the same one
 * the editor applies to a visitor arriving straight at `/editor/` — so whichever
 * of the three a visitor reaches first, they all pick the same language.
 */
export function negotiateRequestLanguage({
  cookie,
  acceptLanguage
}: NegotiationHeaders): LanguageId {
  const preferred = decodePreferences(
    parseCookieHeader(cookie ?? '')[PREFERENCES_COOKIE] ?? null
  ).lang;
  if (isAvailableLanguage(preferred)) {
    return preferred;
  }
  return (
    negotiateLanguage(parseAcceptLanguage(acceptLanguage ?? null)) ??
    DEFAULT_LANGUAGE
  );
}
