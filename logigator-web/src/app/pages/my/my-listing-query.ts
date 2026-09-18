import { ActivatedRouteSnapshot } from '@angular/router';

/** How many rows a shelf draws. Divisible by 2, 3 and 4, so the grid fills
 * whole rows at every breakpoint — the browse listings' own size. */
export const MY_PAGE_SIZE = 24;

/** A shelf's state, read off the URL rather than held in a component: it has to
 * survive a reload and the browser's back button, and a server render has
 * nothing else to read it from.
 *
 * There is no ranking here. A shelf is the reader's own work, and the order
 * that means anything for it is the one the API answers with — most recently
 * edited first, which is where they left off. */
export interface MyListingQuery {
  page: number;
  search: string;
}

/** Tolerant of nonsense: a `?page=nine` is page one, not a 400. The URL is
 * typed by whoever pasted it. */
export function myListingQuery(route: ActivatedRouteSnapshot): MyListingQuery {
  const params = route.queryParamMap;
  const page = Number.parseInt(params.get('page') ?? '', 10);

  return {
    // One-based in the URL, zero-based in the API: a first page called `0` is
    // not something to explain to whoever reads the address bar.
    page: Number.isFinite(page) && page > 1 ? page - 1 : 0,
    search: (params.get('search') ?? '').trim()
  };
}

/** The query parameters a shelf writes back, the first page omitted so the
 * plain URL is what a visitor who changed nothing ends up on. */
export function myListingParams(
  query: Partial<MyListingQuery>
): Record<string, string | null> {
  return {
    page: query.page && query.page > 0 ? String(query.page + 1) : null,
    search: query.search ? query.search : null
  };
}
