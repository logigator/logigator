import { describe, expect, it } from 'vitest';
import { ActivatedRouteSnapshot, convertToParamMap } from '@angular/router';
import {
  listingCanonicalQuery,
  listingParams,
  listingQuery,
  pastLastPage
} from './listing-query';

/** A snapshot carrying only what `listingQuery` reads. */
function route(params: Record<string, string>): ActivatedRouteSnapshot {
  return {
    queryParamMap: convertToParamMap(params)
  } as ActivatedRouteSnapshot;
}

describe('listingQuery', () => {
  it('reads a one-based page as the API’s zero-based one', () => {
    // A first page called `0` is not something to explain to whoever reads the
    // address bar, so the two counts differ and this is where they meet.
    expect(listingQuery(route({ page: '1' })).page).toBe(0);
    expect(listingQuery(route({ page: '4' })).page).toBe(3);
  });

  it('answers the first page for anything it cannot read', () => {
    // The URL is typed by whoever pasted it: nonsense is page one, not a 400.
    for (const page of ['nine', '', '-2', '0', '1.5e9x']) {
      expect(listingQuery(route({ page })).page).toBe(0);
    }
  });

  it('falls back to the default ranking rather than to an unranked read', () => {
    expect(listingQuery(route({})).orderBy).toBe('trending');
    expect(listingQuery(route({ orderBy: 'popularity' })).orderBy).toBe(
      'trending'
    );
    expect(listingQuery(route({ orderBy: 'latest' })).orderBy).toBe('latest');
  });
});

describe('listingParams', () => {
  it('writes no parameter for the default view', () => {
    // Three rankings of one set of documents are one page rather than three:
    // the other two are `noindex`, so the default view has to be the plain URL
    // or the one ranking an index holds would have no address.
    expect(listingParams({ page: 0, search: '', orderBy: 'trending' })).toEqual(
      {
        page: null,
        search: null,
        orderBy: null
      }
    );
  });

  it('round-trips a page, a filter and a ranking through the URL', () => {
    const written = listingParams({
      page: 3,
      search: 'adder',
      orderBy: 'stars'
    });
    expect(written).toEqual({ page: '4', search: 'adder', orderBy: 'stars' });

    const read = listingQuery(route(written as Record<string, string>));
    expect(read).toEqual({ page: 3, search: 'adder', orderBy: 'stars' });
  });
});

describe('listingCanonicalQuery', () => {
  const canonical = (query: string): string =>
    listingCanonicalQuery(new URLSearchParams(query));

  it('keeps a page past the first, so it canonicalizes to itself', () => {
    expect(canonical('page=3')).toBe('?page=3');
    expect(canonical('page=3&orderBy=latest')).toBe('?page=3');
  });

  it('names the first page, however it was written, without a page', () => {
    for (const query of ['', 'page=1', 'page=0', 'page=nine']) {
      expect(canonical(query), query).toBe('');
    }
  });

  it('folds a search, every page of it, into the plain listing', () => {
    expect(canonical('search=adder&page=3')).toBe('');
  });
});

describe('pastLastPage', () => {
  it('finds the first page past the last row, and none before it', () => {
    // 48 rows at 24 a page are pages 0 and 1; one more row opens page 2.
    expect(pastLastPage(1, 48, 24)).toBe(false);
    expect(pastLastPage(2, 48, 24)).toBe(true);
    expect(pastLastPage(2, 49, 24)).toBe(false);
  });

  it('never puts the first page past the end', () => {
    // An empty listing is a page that says so, not a 404.
    expect(pastLastPage(0, 0, 24)).toBe(false);
    expect(pastLastPage(1, 0, 24)).toBe(true);
  });

  it('has no verdict for a read that failed', () => {
    expect(pastLastPage(9, null, 24)).toBe(false);
  });
});
