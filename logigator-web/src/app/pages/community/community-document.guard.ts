import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { communityKindOf } from './community-kind';
import { CommunityDocumentService } from './community-document.service';

/**
 * Resolves the document before its page activates. Never blocks the route: a
 * link naming nothing published is a 404 the page renders with the status, and
 * a read that failed for any other reason keeps the page and offers a retry —
 * a guard returning `false` would answer 200 with the previous page's content.
 */
export const communityDocumentGuard: CanActivateFn = async (route) => {
  await inject(CommunityDocumentService).resolve(
    communityKindOf(route),
    route.paramMap.get('link') ?? ''
  );
  return true;
};
