/**
 * A path is canonical with single separators and no trailing slash. Returns the
 * canonical form of one that is not, and `null` for one that already is.
 *
 * The rule is not cosmetic. Angular's router drops the empty segments a
 * repeated separator makes, so the URL a render ends on differs from the one it
 * was asked for, and `@angular/ssr` reads that difference as a redirect — one
 * it then gives whatever status the page set. The 404 page sets one, so
 * `/en/verify-email/<token>//` answers a `Location` header and a `404` beside
 * it, which is a blank page rather than either.
 */
export function canonicalPath(pathname: string): string | null {
  const canonical = pathname.replace(/\/{2,}/g, '/').replace(/(.)\/$/, '$1');
  return canonical === pathname ? null : canonical;
}
