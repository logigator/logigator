import { ActivatedRouteSnapshot } from '@angular/router';
import type { CommunityOrder } from '../../api/services/community-api.service';

/** How many rows a browse page draws. Divisible by 2, 3 and 4, so the grid
 * fills whole rows at every breakpoint. */
export const BROWSE_PAGE_SIZE = 24;

/** A stargazer list is one column of names, so it takes a longer page. */
export const STARGAZER_PAGE_SIZE = 30;

/**
 * The default ranking, which is also the API's. It deliberately carries **no
 * query parameter**: three rankings of one set of documents are one page rather
 * than three, and the canonical drops `orderBy` entirely — so a share of any
 * sort reports the default view.
 */
export const DEFAULT_ORDER: CommunityOrder = 'trending';

/** The rankings a browse page offers, in the order the control shows them. */
export const COMMUNITY_ORDERS: readonly CommunityOrder[] = [
  'trending',
  'stars',
  'latest'
];

export interface ListingQuery {
  page: number;
  search: string;
  orderBy: CommunityOrder;
}

/**
 * A listing's state, read off the URL rather than held in a component: it has
 * to survive a reload, a shared link and the browser's back button, and a
 * server render has nothing else to read it from.
 *
 * Everything is tolerant of nonsense — a `?page=nine` is page one, not a 400.
 * The URL is typed by whoever pasted it.
 */
export function listingQuery(route: ActivatedRouteSnapshot): ListingQuery {
  const params = route.queryParamMap;
  const orderBy = params.get('orderBy');

  return {
    page: pageIndex(params.get('page')),
    search: (params.get('search') ?? '').trim(),
    orderBy: isCommunityOrder(orderBy) ? orderBy : DEFAULT_ORDER
  };
}

/**
 * The query a listing's canonical keeps: its page, so each page is indexed as
 * itself rather than folded into the first. The ranking is dropped like
 * everywhere else, and a search folds the whole result into the plain listing.
 */
export function listingCanonicalQuery(query: URLSearchParams): string {
  if (query.get('search')?.trim()) {
    return '';
  }
  const { page } = listingParams({ page: pageIndex(query.get('page')) });
  return page ? `?page=${page}` : '';
}

/**
 * One-based in the URL, zero-based in the API: a first page called `0` is not
 * something to explain to whoever reads the address bar.
 */
function pageIndex(value: string | null): number {
  const page = Number.parseInt(value ?? '', 10);
  return Number.isFinite(page) && page > 1 ? page - 1 : 0;
}

/**
 * The query parameters a listing state writes back. The default ranking and the
 * first page are omitted rather than spelled out, so the plain URL is what a
 * visitor who changed nothing ends up sharing.
 */
export function listingParams(
  query: Partial<ListingQuery>
): Record<string, string | null> {
  return {
    page: query.page && query.page > 0 ? String(query.page + 1) : null,
    search: query.search ? query.search : null,
    orderBy:
      query.orderBy && query.orderBy !== DEFAULT_ORDER ? query.orderBy : null
  };
}

function isCommunityOrder(value: string | null): value is CommunityOrder {
  return COMMUNITY_ORDERS.includes(value as CommunityOrder);
}
