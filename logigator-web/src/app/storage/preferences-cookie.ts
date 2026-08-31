/**
 * The origin-wide `preferences` cookie, as data. Pure functions, no Angular:
 * the SSR server reads the same cookie off a raw request before the app exists,
 * to decide which language an unprefixed URL redirects to.
 */

export const PREFERENCES_COOKIE = 'preferences';

/** Express serializes an object cookie value as `j:` + JSON, URI-encoded. */
const JSON_PREFIX = 'j:';

/**
 * Fields of the cookie this app uses. Others may be present — the legacy
 * backend writes it too — so reads and writes keep the rest intact.
 */
export interface Preferences {
  lang?: string;
  theme?: string;
  [field: string]: unknown;
}

/** Splits a `Cookie` header (or `document.cookie`) into raw name/value pairs. */
export function parseCookieHeader(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 1) {
      continue;
    }
    const name = pair.slice(0, separator).trim();
    if (name && !(name in cookies)) {
      cookies[name] = pair.slice(separator + 1).trim();
    }
  }
  return cookies;
}

/**
 * The cookie's fields; `{}` for an absent or malformed value. The cookie is
 * client-writable, so anything unreadable is absorbed here and every consumer
 * falls back to its own default.
 */
export function decodePreferences(raw: string | null): Preferences {
  if (!raw) {
    return {};
  }
  try {
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith(JSON_PREFIX)) {
      return {};
    }
    const parsed: unknown = JSON.parse(decoded.slice(JSON_PREFIX.length));
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Preferences)
      : {};
  } catch {
    return {};
  }
}

/** The cookie value for a set of fields, in the encoding the origin expects. */
export function encodePreferences(preferences: Preferences): string {
  return encodeURIComponent(`${JSON_PREFIX}${JSON.stringify(preferences)}`);
}
