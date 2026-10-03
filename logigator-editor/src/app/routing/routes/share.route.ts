import { Route } from '../route.model';
import { inject, Injectable } from '@angular/core';
import { Location } from '@angular/common';
import { isApiError } from '@logigator/contract';
import type { LgCommunityKind } from '@logigator/ui';
import { PersistenceService } from '../../persistence/persistence.service';
import { RouteKeys } from '../route-keys.model';
import { apiKindOf } from '../document-kind';

/**
 * `/share/projects/:linkId` and `/share/components/:linkId` — a document
 * somebody was handed, opened read-only in the main slot. This is where the
 * site's own page for a document sends a reader (`/community/{kind}/{link}` →
 * the editor), so the kind segment is the route's plural and the API's singular
 * is derived from it in `routing/document-kind.ts`.
 *
 * The kind is a **literal in the tree**, one subclass per kind, because a
 * pattern that matches a segment and then declines it has already claimed the
 * path: nothing else matches, so `RouterService` answers not-found, and the
 * startup's blank draft — created only when *no* pattern matches — never
 * happens. A reader handed `/share/project/{link}` (the API's singular, which
 * the card URL is built from) was left with a toast and an empty main slot
 * rather than an editor. A path naming no kind now matches nothing at all,
 * which is the not-found `/nonsense` has always been.
 *
 * What a subclass declares is its kind and nothing else, the pattern being
 * composed from it below, so a kind and the URL it answers cannot drift apart.
 * Both are `@Injectable({ providedIn: 'root' })`: `RouterService` instantiates
 * each route class through DI rather than constructing it.
 */
abstract class ShareRouteBase implements Route {
  private readonly persistenceService = inject(PersistenceService);

  /** The route's spelling of the kind, which is also its pattern segment. */
  protected abstract readonly kind: LgCommunityKind;

  get route(): string {
    return `/share/${this.kind}/:linkId`;
  }

  // Typed to the one parameter both patterns carry rather than
  // `RouteKeys<typeof this.route>`: a base's pattern is not a literal type, so
  // the keys would resolve to an index signature and `linkId` would come back
  // as `string | null`.
  async onActivation(params: { linkId: string }): Promise<boolean> {
    await this.persistenceService.loadShareAsMain(
      apiKindOf(this.kind),
      params.linkId
    );
    return true;
  }
}

/** The project table's share link. */
@Injectable({
  providedIn: 'root'
})
export class ShareProjectRoute extends ShareRouteBase {
  protected override readonly kind = 'projects' as const;
}

/** The component table's share link. */
@Injectable({
  providedIn: 'root'
})
export class ShareComponentRoute extends ShareRouteBase {
  protected override readonly kind = 'components' as const;
}

/**
 * `/share/:linkId` — the kind-free URL the legacy editor minted for years, kept
 * resolving because those links are out in the world.
 *
 * The link alone no longer says which table it lives in, so the kind is looked
 * up: **projects first, then components**, and the fallthrough happens on a
 * definitive `not_found` alone. A `5xx` or a transport error is not an answer
 * about the kind — the other table would fail the same way — so it surfaces as
 * itself, which is why the first attempt defers that one answer instead of
 * swallowing every failure and reporting the last one twice.
 *
 * The URL is then rewritten to the kind-carrying form, so a legacy link
 * upgrades itself on the first visit and the back button does not return to a
 * shape this app only reads.
 */
@Injectable({
  providedIn: 'root'
})
export class LegacyShareRoute implements Route {
  private readonly persistenceService = inject(PersistenceService);
  private readonly location = inject(Location);

  readonly route = '/share/:linkId';

  async onActivation(params: RouteKeys<typeof this.route>): Promise<boolean> {
    const { linkId } = params;

    const first = await this.persistenceService.loadShareAsMain(
      'project',
      linkId,
      { deferNotFound: true }
    );
    if (first.loaded) {
      this._upgrade('projects', linkId);
      return true;
    }
    if (!isApiError(first.error, 'not_found')) return true;

    // The other table's attempt is the one that reports: a failure there is
    // the last word, so it toasts, and one share load is still one report.
    const second = await this.persistenceService.loadShareAsMain(
      'component',
      linkId
    );
    if (second.loaded) this._upgrade('components', linkId);
    return true;
  }

  /**
   * Moves the address to the shape this app serves, replacing rather than
   * pushing: the legacy URL was never a page of its own, and back should leave
   * the document rather than return to a shape that would resolve it again.
   */
  private _upgrade(kind: LgCommunityKind, linkId: string): void {
    this.location.replaceState(`/share/${kind}/${linkId}`);
  }
}
