import { computed, inject, Injectable, signal } from '@angular/core';
import type { Author } from '@logigator/contract';
import type { CommunityKind } from '../../api/services/community-api.service';
import { CommunityApiService } from '../../api/services/community-api.service';
import { contentSection } from '../../transfer/content-section';
import { STARGAZER_PAGE_SIZE } from './listing-query';

/**
 * Who starred a document, most recent first.
 *
 * Public and paginated for everybody, which is the legacy bug this closes: over
 * there the first page rendered for anyone, while the endpoint that paged it
 * sat behind an authentication middleware — so a visitor could see twenty
 * names and never the twenty-first.
 */
@Injectable({ providedIn: 'root' })
export class StargazersService {
  private readonly communityApi = inject(CommunityApiService);

  private readonly target = signal<{
    kind: CommunityKind;
    link: string;
    page: number;
  }>({ kind: 'projects', link: '', page: 0 });

  public readonly page = computed(() => this.target().page);

  public readonly listing = contentSection<Author>(
    'community.stargazers',
    () => {
      const { kind, link, page } = this.target();
      return this.communityApi.stargazers(kind, link, {
        page,
        size: STARGAZER_PAGE_SIZE
      });
    }
  );

  public readonly pageCount = computed(() => {
    const total = this.listing.total();
    return total === null
      ? 1
      : Math.max(1, Math.ceil(total / STARGAZER_PAGE_SIZE));
  });

  public async resolve(
    kind: CommunityKind,
    link: string,
    page: number
  ): Promise<void> {
    this.target.set({ kind, link, page });
    await this.listing.resolve();
  }
}
