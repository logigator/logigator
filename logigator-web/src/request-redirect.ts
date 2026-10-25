import type { LanguageId } from '@logigator/core';
import {
  languageFromPath,
  pathInLanguage,
  urlInLanguage
} from './app/translation/language-url';
import { canonicalPath } from './canonical-path';
import { legacyRedirect } from './legacy-redirects';
import { SITEMAP_FILE_PATH } from './sitemap';

/** Where a request is sent instead of being answered at the URL it named. */
export interface RequestRedirect {
  readonly status: 301 | 302;
  readonly location: string;
  /**
   * Whether the location depends on the visitor's `preferences` cookie and
   * `Accept-Language`, rather than on the URL alone.
   */
  readonly negotiated: boolean;
}

/** A path that names a file nothing here serves, answered with a bare `404`. */
export const NOT_FOUND = 'not-found';

/** The files answered at the root of the origin rather than in a language. */
const ROOT_FILE = /^\/(?:robots\.txt|sitemap\.xml)$/;

/** The files a language prefix holds: the markdown twins and the feed. */
const LOCALIZED_FILE = /^\/docs\/[a-z0-9-]+\.md$|^\/changelog\.atom$/;

/** A last segment with a file extension. */
const FILE = /\.[A-Za-z0-9]+$/;

/**
 * What a `GET` for this path and query (`?…` or empty) is answered with before
 * anything reads a segment out of it: one redirect to the URL that answers it,
 * a bare `404`, or `null` to go on.
 *
 * One hop whatever is wrong with the URL — a repeated or trailing separator, a
 * legacy path, a missing language — because each hop is a round trip and a
 * crawler follows only so many. A URL with no language takes the visitor's;
 * `negotiate` is asked only then.
 *
 * A legacy path keeps its `301` even where the language in its target is
 * negotiated: the old URL is gone for good wherever it leads, and a `302` would
 * leave it standing in an index as the address of the page. The target still
 * differs per visitor, which {@link redirectHeaders} says.
 *
 * A path with a file extension and no language is a file, and the static
 * handler has already answered every file there is, so it ends here instead of
 * negotiating a language for a render that can only be the 404 page. The
 * exceptions are the localized files, which negotiate like a page.
 */
export function requestRedirect(
  pathname: string,
  search: string,
  negotiate: () => LanguageId
): RequestRedirect | typeof NOT_FOUND | null {
  const path = canonicalPath(pathname) ?? pathname;
  const lang = languageFromPath(path);

  const legacy = legacyRedirect(path, new URLSearchParams(search));
  if (legacy) {
    return {
      status: legacy.status,
      location: urlInLanguage(lang ?? negotiate(), legacy.location),
      negotiated: lang === null
    };
  }

  const moved: RequestRedirect | null =
    path === pathname
      ? null
      : { status: 301, location: path + search, negotiated: false };
  if (lang || ROOT_FILE.test(path) || SITEMAP_FILE_PATH.test(path)) {
    return moved;
  }
  if (FILE.test(path) && !LOCALIZED_FILE.test(path)) {
    return moved ?? NOT_FOUND;
  }
  return {
    status: 302,
    location: pathInLanguage(negotiate(), path) + search,
    negotiated: true
  };
}

/** How long a redirect that is the same for everyone, for good, may be held. */
const PERMANENT_REDIRECT_MAX_AGE = 86_400;

/**
 * The caching headers of a redirect. A negotiated one is the visitor's own and
 * names what it was negotiated from. A permanent one is held for a day rather
 * than for as long as a browser cares to, which with no `Cache-Control` is
 * forever: a map entry that turns out wrong is then a deploy away from fixed. A
 * temporary one is not held at all.
 */
export function redirectHeaders(
  redirect: RequestRedirect
): Record<string, string> {
  if (redirect.negotiated) {
    return {
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Accept-Language'
    };
  }
  return {
    'Cache-Control':
      redirect.status === 301
        ? `public, max-age=${PERMANENT_REDIRECT_MAX_AGE}`
        : 'no-store'
  };
}
