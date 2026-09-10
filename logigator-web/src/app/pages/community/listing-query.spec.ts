import { describe, expect, it } from 'vitest';
import { ActivatedRouteSnapshot, convertToParamMap } from '@angular/router';
import { listingParams, listingQuery } from './listing-query';

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
    // the canonical drops `orderBy` entirely, so the default view has to be the
    // plain URL or a share of it would report a page the canonical disowns.
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
