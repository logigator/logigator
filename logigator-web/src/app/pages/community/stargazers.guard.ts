import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { communityKindOf } from './community-kind';
import { listingQuery } from './listing-query';
import { StargazersService } from './stargazers.service';

/**
 * Resolves one page of stargazers before the list activates. It runs beside
 * `communityDocumentGuard`, which is what gives the page its heading and its
 * trail — the list is a page about a document, so the document has to be
 * resolved too.
 */
export const stargazersGuard: CanActivateFn = async (route) => {
  await inject(StargazersService).resolve(
    communityKindOf(route),
    route.paramMap.get('link') ?? '',
    listingQuery(route).page
  );
  return true;
};
