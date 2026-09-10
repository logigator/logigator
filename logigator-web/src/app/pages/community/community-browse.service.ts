import { computed, inject, Injectable, signal } from '@angular/core';
import type { CommunityKind } from '../../api/services/community-api.service';
import { CommunityApiService } from '../../api/services/community-api.service';
import { CommunityRow } from '../../documents/circuit-tile-entry';
import { contentSection } from '../../transfer/content-section';
import { BROWSE_PAGE_SIZE, DEFAULT_ORDER, ListingQuery } from './listing-query';

/**
 * One page of the community's published documents, whichever of the two tables
 * it came from.
 *
 * The listing is resolved by a guard, so a server render carries the tiles in
 * its first byte and there is no skeleton anywhere on the page. The query is
 * set from the URL before the read, which is what makes a pasted link, a reload
 * and the back button all answer the same rows.
 *
 * One hand-off key for both kinds: only one browse page renders per document,
 * and the key is consumed on hydration, so a later client-side navigation to
 * the other kind asks the API rather than replaying page load.
 */
@Injectable({ providedIn: 'root' })
export class CommunityBrowseService {
  private readonly communityApi = inject(CommunityApiService);

  private readonly _kind = signal<CommunityKind>('projects');
  private readonly _query = signal<ListingQuery>({
    page: 0,
    search: '',
    orderBy: DEFAULT_ORDER
  });

  public readonly kind = this._kind.asReadonly();
  public readonly query = this._query.asReadonly();

  public readonly listing = contentSection<CommunityRow>(
    'community.browse',
    () => {
      const { page, search, orderBy } = this._query();
      const request = {
        page,
        size: BROWSE_PAGE_SIZE,
        orderBy,
        // Omitted rather than sent empty: the API trims and treats the absent
        // case as "no filter", and an empty `search=` in the log is noise.
        ...(search ? { search } : {})
      };
      return this._kind() === 'projects'
        ? this.communityApi.projects(request)
        : this.communityApi.components(request);
    }
  );

  /** How many pages the match spans, at least one so the control has a state. */
  public readonly pageCount = computed(() => {
    const total = this.listing.total();
    return total === null
      ? 1
      : Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));
  });

  public async resolve(
    kind: CommunityKind,
    query: ListingQuery
  ): Promise<void> {
    this._kind.set(kind);
    this._query.set(query);
    await this.listing.resolve();
  }
}
