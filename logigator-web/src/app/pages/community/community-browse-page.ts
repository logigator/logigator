import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LgButton,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgPaginator
} from '@logigator/ui';
import { CircuitTiles } from '../../documents/circuit-tiles';
import { toTileEntries } from '../../documents/circuit-tile-entry';
import { SiteLinks } from '../../layout/site-links';
import { EmptyState } from '../../states/empty-state';
import { SectionError } from '../../states/section-error';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationKey } from '../../translation/translation-key.model';
import { TranslationService } from '../../translation/translation.service';
import { CommunityBrowseService } from './community-browse.service';
import {
  BROWSE_PAGE_SIZE,
  COMMUNITY_ORDERS,
  DEFAULT_ORDER,
  listingParams
} from './listing-query';

/** The label each ranking is offered under. */
const ORDER_KEYS: Record<string, TranslationKey> = {
  trending: 'pages.community.browse.orderTrending',
  stars: 'pages.community.browse.orderStars',
  latest: 'pages.community.browse.orderLatest'
};

/**
 * The community's published documents, browsable: search, ranking, and a page
 * at a time.
 *
 * Every control writes the URL rather than component state — the guard reads it
 * back and re-resolves — so a ranking, a search and a page are all shareable,
 * survive a reload and answer in the server's first byte. The kind switch and
 * the ranking are links and the filter is a real `<form method="get">`, so all
 * three work before any script has run; the paginator is the one control that
 * needs one.
 */
@Component({
  selector: 'web-community-browse-page',
  imports: [
    CircuitTiles,
    EmptyState,
    LgButton,
    LgIconField,
    LgInputIcon,
    LgInputText,
    LgPaginator,
    RouterLink,
    SectionError,
    TranslateDirective
  ],
  templateUrl: './community-browse-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityBrowsePage {
  private readonly browse = inject(CommunityBrowseService);
  private readonly router = inject(Router);
  private readonly translation = inject(TranslationService);

  protected readonly links = inject(SiteLinks);
  protected readonly listing = this.browse.listing;
  protected readonly query = this.browse.query;
  protected readonly pageCount = this.browse.pageCount;
  protected readonly pageSize = BROWSE_PAGE_SIZE;
  protected readonly defaultOrder = DEFAULT_ORDER;

  protected readonly isProjects = computed(
    () => this.browse.kind() === 'projects'
  );

  /** The page's own path: what the form posts to and the links point at. */
  protected readonly path = computed(() =>
    this.isProjects()
      ? this.links.communityProjects()
      : this.links.communityComponents()
  );

  protected readonly orders = computed(() => {
    const current = this.query();
    return COMMUNITY_ORDERS.map((orderBy) => ({
      orderBy,
      labelKey: ORDER_KEYS[orderBy]!,
      active: current.orderBy === orderBy,
      // A ranking change starts over at the first page: page four of the
      // newest has nothing to do with page four of the most starred.
      params: listingParams({ orderBy, search: current.search })
    }));
  });

  protected readonly tiles = computed(() =>
    toTileEntries(this.listing.entries() ?? [], {
      href: (row) => this.links.communityDocument(this.browse.kind(), row.link),
      authorHref: (row) => this.links.communityUser(row.author.id)
    })
  );

  /** A filter that matched nothing is a different state from an empty table,
   * and the two get different words and different actions. */
  protected readonly searched = computed(() => this.query().search.length > 0);

  /** Per locale, so a four-digit count is grouped the way the reader writes it. */
  protected readonly totalLabel = computed(() =>
    new Intl.NumberFormat(this.translation.activeLang()).format(
      this.listing.total() ?? 0
    )
  );

  /**
   * Claims the submit where there is script to claim it, so filtering is a
   * router navigation rather than a document load. The form's own `action`
   * answers where there is not.
   */
  protected onSearch(event: Event): void {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const search = new FormData(form).get('search');
    void this.router.navigate([this.path()], {
      queryParams: listingParams({
        search: typeof search === 'string' ? search.trim() : '',
        orderBy: this.query().orderBy
      })
    });
  }

  protected async toPage(page: number): Promise<void> {
    const { search, orderBy } = this.query();
    await this.router.navigate([this.path()], {
      queryParams: listingParams({ page, search, orderBy })
    });
  }

  protected retry(): Promise<void> {
    return this.listing.retry();
  }

  protected tabClass(active: boolean): string {
    return (
      'rounded-md px-3 py-1.5 text-sm font-medium ' +
      (active
        ? 'bg-content-hover text-text-hover'
        : 'text-muted hover:bg-content-hover hover:text-text')
    );
  }

  protected orderClass(active: boolean): string {
    return (
      'rounded-md px-2.5 py-1.5 ' +
      (active
        ? 'bg-primary-100 font-medium text-primary-800 dark:bg-primary/24 dark:text-text'
        : 'text-muted hover:bg-content-hover hover:text-text')
    );
  }
}
