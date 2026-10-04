import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { DocsSearchService } from './docs-search.service';

/**
 * Answers the URL's query before the index page activates, so a `?q=` render
 * carries its results in the first byte — the way every other list on this site
 * is resolved, and what keeps the page from drawing its contents list for a
 * moment first.
 *
 * It runs on a navigation to the route, not on the debounced `?q=` writes the
 * field makes while someone types: the router's default only re-runs guards
 * when a path parameter changes, and the field has already answered those
 * itself.
 */
export const docsSearchGuard: CanActivateFn = async (route) => {
  await inject(DocsSearchService).resolve(route.queryParamMap.get('q') ?? '');
  return true;
};
