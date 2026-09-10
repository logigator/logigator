import {
  computed,
  inject,
  Injectable,
  makeStateKey,
  signal
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiError, type PublicProfile } from '@logigator/contract';
import { CommunityApiService } from '../../api/services/community-api.service';
import { CommunityRow } from '../../documents/circuit-tile-entry';
import { genericFailureKey } from '../../forms/api-failure';
import { contentSection } from '../../transfer/content-section';
import { TransferHandoffService } from '../../transfer/transfer-handoff.service';
import { TranslationKey } from '../../translation/translation-key.model';
import { BROWSE_PAGE_SIZE, ListingQuery } from './listing-query';

/** Which of a member's four public listings a route shows. */
export type ProfileSection =
  'projects' | 'components' | 'starred-projects' | 'starred-components';

type ProfileResult =
  | { profile: PublicProfile }
  | { missing: true }
  | { failureKey: TranslationKey };

const PROFILE_STATE = makeStateKey<ProfileResult>('community.profile');

/**
 * A member's public page: who they are, and one of the four lists of documents
 * they either published or starred.
 *
 * The profile and the listing are resolved separately — the header survives a
 * listing that failed, and switching tabs re-reads only the list. Both are
 * guards, so a server render carries the header and the tiles in its first
 * byte.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly communityApi = inject(CommunityApiService);
  private readonly handoff = inject(TransferHandoffService);

  private readonly result = signal<ProfileResult>({ missing: true });
  private readonly _section = signal<ProfileSection>('projects');
  private readonly _query = signal<Pick<ListingQuery, 'page'>>({ page: 0 });
  private readonly _retrying = signal(false);
  private userId = '';

  public readonly profile = computed(() => {
    const current = this.result();
    return 'profile' in current ? current.profile : null;
  });

  /** True where the id names no account — the page's own 404. */
  public readonly missing = computed(() => 'missing' in this.result());

  public readonly failureKey = computed(() => {
    const current = this.result();
    return 'failureKey' in current ? current.failureKey : null;
  });

  public readonly retrying = this._retrying.asReadonly();
  public readonly section = this._section.asReadonly();
  public readonly page = computed(() => this._query().page);

  public readonly listing = contentSection<CommunityRow>(
    'community.profile.listing',
    () => {
      const request = { page: this._query().page, size: BROWSE_PAGE_SIZE };
      const id = this.userId;
      switch (this._section()) {
        case 'projects':
          return this.communityApi.userProjects(id, request);
        case 'components':
          return this.communityApi.userComponents(id, request);
        case 'starred-projects':
          return this.communityApi.userStarredProjects(id, request);
        case 'starred-components':
          return this.communityApi.userStarredComponents(id, request);
      }
    }
  );

  public readonly pageCount = computed(() => {
    const total = this.listing.total();
    return total === null
      ? 1
      : Math.max(1, Math.ceil(total / BROWSE_PAGE_SIZE));
  });

  /** Whether the rows all share an author — the member's own work — which is
   * what decides whether a tile carries a meta row at all. */
  public readonly ownWork = computed(
    () => this._section() === 'projects' || this._section() === 'components'
  );

  public async resolveProfile(userId: string): Promise<void> {
    this.userId = userId;
    this.result.set(
      await this.handoff.resolve(PROFILE_STATE, () => this.fetch(userId))
    );
  }

  public async resolveListing(
    userId: string,
    section: ProfileSection,
    page: number
  ): Promise<void> {
    this.userId = userId;
    this._section.set(section);
    this._query.set({ page });
    await this.listing.resolve();
  }

  /** Asks again after a read that failed; not through the hand-off, which
   * holds the answer that failed. */
  public async retryProfile(): Promise<void> {
    if (this._retrying()) return;
    this._retrying.set(true);
    try {
      this.result.set(await this.fetch(this.userId));
    } finally {
      this._retrying.set(false);
    }
  }

  private async fetch(userId: string): Promise<ProfileResult> {
    try {
      return {
        profile: await firstValueFrom(this.communityApi.profile(userId))
      };
    } catch (error) {
      if (isApiError(error, 'not_found')) {
        return { missing: true };
      }
      return { failureKey: genericFailureKey(error) };
    }
  }
}
