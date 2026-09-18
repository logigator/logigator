import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { communityKindOf } from './community-kind';
import { CommunityBrowseService } from './community-browse.service';
import { listingQuery } from './listing-query';

/**
 * Answers the URL's page, search and ranking before the browse page activates,
 * so the first byte carries the tiles — the rule every list on this site
 * follows, and what makes the page work with no JavaScript at all.
 *
 * The route sets `runGuardsAndResolvers: 'paramsOrQueryParamsChange'`, since
 * the router's default only re-runs a guard when a *path* parameter changes and
 * every control on this page writes a query parameter.
 */
export const communityBrowseGuard: CanActivateFn = async (route) => {
  await inject(CommunityBrowseService).resolve(
    communityKindOf(route),
    listingQuery(route)
  );
  return true;
};
