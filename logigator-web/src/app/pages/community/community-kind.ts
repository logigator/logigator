import { ActivatedRouteSnapshot } from '@angular/router';
import type { LgDocumentKind } from '@logigator/ui';
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

/**
 * The same kind in the API's spelling, for the URLs that address a table rather
 * than a section: a card is `/api/share/project/{link}/card.png` and a clone is
 * `POST /api/share/project/{link}/clone`, while every route here says
 * `projects`. Made in one place rather than at each call site because the two
 * spellings are deliberately distinct types — `@logigator/ui`'s card builder
 * takes one and its page builder the other, so a call site handed the wrong one
 * does not compile — and somebody still has to choose.
 */
export function apiKindOf(kind: CommunityKind): LgDocumentKind {
  return kind === 'projects' ? 'project' : 'component';
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
