import { ActivatedRouteSnapshot } from '@angular/router';
import type { CommunityKind } from '../../api/services/community-api.service';

/**
 * Which of the two tables a route addresses — the community listings' and the
 * reader's own shelves' alike. Route data rather than a path parameter: the two
 * are symmetric in shape but not interchangeable — a component carries a symbol
 * and a port surface a project has no equivalent of — and a page reading a
 * literal segment would have to trust it.
 */
export interface CommunityRouteData {
  communityKind: CommunityKind;
}

export function communityKindOf(route: ActivatedRouteSnapshot): CommunityKind {
  // Walked upwards: a child route (the stargazer list) inherits the kind from
  // the document route it hangs under rather than declaring it again.
  for (
    let current: ActivatedRouteSnapshot | null = route;
    current;
    current = current.parent
  ) {
    const kind = (current.data as Partial<CommunityRouteData>).communityKind;
    if (kind) return kind;
  }
  throw new Error('A document route must declare its `communityKind`.');
}
