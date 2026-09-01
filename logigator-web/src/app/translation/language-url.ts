import { isAvailableLanguage, LanguageId } from '@logigator/core';

/**
 * Every page lives under a language segment (`/de/features`). The legacy
 * middleware stripped that segment from `request.url` before routing, so
 * nothing downstream saw it; here it is a real route parameter, which means it
 * has to be added and removed in exactly one place — this module, shared by the
 * Angular app and the SSR server's redirect.
 */

/** The language a path is prefixed with, or `null` when it carries none. */
export function languageFromPath(pathname: string): LanguageId | null {
  const segment = pathname.split('/')[1];
  return isAvailableLanguage(segment) ? segment : null;
}

/** A path with its language segment removed; always starts with `/`. */
export function pathWithoutLanguage(pathname: string): string {
  if (!languageFromPath(pathname)) {
    return pathname || '/';
  }
  const rest = pathname.slice(pathname.indexOf('/', 1));
  return rest.startsWith('/') ? rest : '/';
}

/** The same page in a given language. `path` may carry a prefix or not. */
export function pathInLanguage(lang: LanguageId, pathname: string): string {
  const rest = pathWithoutLanguage(pathname);
  return rest === '/' ? `/${lang}` : `/${lang}${rest}`;
}

/**
 * The path part of a URL, with the query and fragment removed. Everything that
 * reads a path out of a router URL goes through here: the functions above split
 * on `/`, so a query left attached reads as part of the first segment and a
 * prefix is neither found nor stripped.
 */
export function pathnameFromUrl(url: string): string {
  const suffix = url.search(/[?#]/);
  return (suffix === -1 ? url : url.slice(0, suffix)) || '/';
}

/**
 * A whole URL — path plus query and fragment — in another language. What a
 * language switch links to, so the page the visitor is on survives the switch
 * along with whatever it was showing.
 */
export function urlInLanguage(lang: LanguageId, url: string): string {
  const suffix = url.search(/[?#]/);
  const rest = suffix === -1 ? '' : url.slice(suffix);
  return pathInLanguage(lang, pathnameFromUrl(url)) + rest;
}
