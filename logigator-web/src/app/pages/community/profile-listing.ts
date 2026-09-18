import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { Router } from '@angular/router';
import { LgPaginator } from '@logigator/ui';
import { CircuitTiles } from '../../documents/circuit-tiles';
import { toTileEntries } from '../../documents/circuit-tile-entry';
import { SiteLinks } from '../../layout/site-links';
import { EmptyState } from '../../states/empty-state';
import { SectionError } from '../../states/section-error';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationKey } from '../../translation/translation-key.model';
import { BROWSE_PAGE_SIZE, listingParams } from './listing-query';
import { ProfileService } from './profile.service';

/** What an empty tab says, per tab. All four are somebody else's list, so none
 * of them offers an action — a statement, no invitation. */
const EMPTY_KEYS: Record<string, TranslationKey> = {
  projects: 'pages.community.profile.emptyProjects',
  components: 'pages.community.profile.emptyComponents',
  'starred-projects': 'pages.community.profile.emptyStarredProjects',
  'starred-components': 'pages.community.profile.emptyStarredComponents'
};

/**
 * One of a profile's four listings, rendered into the page's outlet.
 *
 * The tile's meta row carries the author only where the rows do not all share
 * one: a member's own work says so once, in the heading above; their starred
 * shelf is other people's, so each row names whose.
 */
@Component({
  selector: 'web-profile-listing',
  imports: [
    CircuitTiles,
    EmptyState,
    LgPaginator,
    SectionError,
    TranslateDirective
  ],
  host: { class: 'block' },
  templateUrl: './profile-listing.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileListing {
  private readonly content = inject(ProfileService);
  private readonly router = inject(Router);

  protected readonly links = inject(SiteLinks);
  protected readonly listing = this.content.listing;
  protected readonly page = this.content.page;
  protected readonly pageCount = this.content.pageCount;
  protected readonly pageSize = BROWSE_PAGE_SIZE;

  protected readonly emptyKey = computed(
    () => EMPTY_KEYS[this.content.section()]!
  );

  protected readonly tiles = computed(() => {
    const section = this.content.section();
    // Which table a row came from is the section, not something on the row.
    const kind = section.endsWith('components') ? 'components' : 'projects';
    return toTileEntries(this.listing.entries() ?? [], {
      href: (row) => this.links.communityDocument(kind, row.link),
      // Suppressed together with the star count, which is what a list whose
      // rows all share an author wants.
      ...(this.content.ownWork()
        ? {}
        : { authorHref: (row) => this.links.communityUser(row.author.id) })
    });
  });

  protected async toPage(page: number): Promise<void> {
    await this.router.navigate([], {
      queryParams: listingParams({ page })
    });
  }

  protected retry(): Promise<void> {
    return this.listing.retry();
  }
}
