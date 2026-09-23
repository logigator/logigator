import { Injectable } from '@angular/core';
import { Location, PathLocationStrategy } from '@angular/common';

/**
 * The path strategy, writing the editor's root without a trailing slash.
 *
 * The editor's address is `/editor`, not `/editor/`: that is what every link
 * into it names. The base href keeps its slash all the same — it is what the
 * build's relative asset URLs resolve against, and `/editor` alone would
 * resolve them against the origin root — so the stock strategy, joining the
 * base and an internal `/`, would write `/editor/` into the address bar on
 * every return to a blank draft.
 *
 * Only the path's own trailing slash goes, so a query or a fragment is kept,
 * and an editor served at the origin root still writes `/`. Reading needs no
 * counterpart: `Location` strips its base path from `/editor` and `/editor/`
 * alike, both arriving at the root route.
 */
@Injectable()
export class EditorLocationStrategy extends PathLocationStrategy {
  public override prepareExternalUrl(internal: string): string {
    const external = super.prepareExternalUrl(internal);
    const pathEnd = external.search(/[?#]|$/);
    return pathEnd > 1 && external[pathEnd - 1] === '/'
      ? external.slice(0, pathEnd - 1) + external.slice(pathEnd)
      : external;
  }
}

/**
 * Rewrites the address the editor was opened at into the form it writes
 * itself, in place, so `/editor/` becomes `/editor` without a history entry.
 *
 * This is the editor's job rather than the server's because the server cannot
 * redirect `/editor/` at all: the legacy backend answered `/editor` with a
 * `301` to `/editor/` for years, carrying no cache headers, so browsers hold it
 * with no expiry — and a redirect back would loop those visitors between the
 * cached one and the live one. Both spellings are therefore served the same
 * shell, and this is where they converge.
 */
export function canonicalizeAddress(
  location: Location,
  address: Pick<globalThis.Location, 'pathname' | 'search' | 'hash'>
): void {
  const opened = address.pathname + address.search + address.hash;
  const internal = location.path(true);
  if (location.prepareExternalUrl(internal) !== opened) {
    location.replaceState(internal);
  }
}
