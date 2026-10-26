import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { communityKindOf } from './community-kind';
import { lastPageUrl, listingQuery } from './listing-query';
import { StargazersService } from './stargazers.service';

/**
 * Resolves one page of stargazers before the list activates. It runs beside
 * `communityDocumentGuard`, which is what gives the page its heading and its
 * trail — the list is a page about a document, so the document has to be
 * resolved too.
 */
export const stargazersGuard: CanActivateFn = async (route, state) => {
  const stargazers = inject(StargazersService);
  const router = inject(Router);
  await stargazers.resolve(
    communityKindOf(route),
    route.paramMap.get('link') ?? '',
    listingQuery(route).page
  );
  return stargazers.pastLastPage()
    ? lastPageUrl(router, state.url, stargazers.pageCount())
    : true;
};
