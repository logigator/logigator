import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { communityKindOf } from '../community/community-kind';
import { MyDocumentsService } from './my-documents.service';
import { myListingQuery } from './my-listing-query';

/**
 * Answers the URL's page and search before the shelf activates, so the first
 * byte carries the tiles — the rule every list on this site follows.
 *
 * The route sets `runGuardsAndResolvers: 'paramsOrQueryParamsChange'`, since
 * the router's default only re-runs a guard when a *path* parameter changes and
 * both controls on this page write a query parameter.
 */
export const myDocumentsGuard: CanActivateFn = async (route) => {
  await inject(MyDocumentsService).resolve(
    communityKindOf(route),
    myListingQuery(route)
  );
  return true;
};
