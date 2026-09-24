import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LgAvatar, LgPaginator } from '@logigator/ui';
import { SiteLinks } from '../../layout/site-links';
import { EmptyState } from '../../states/empty-state';
import { SectionError } from '../../states/section-error';
import { NotFoundPage } from '../not-found/not-found-page';
import { TranslateDirective } from '../../translation/translate.directive';
import { CommunityDocumentService } from './community-document.service';
import { STARGAZER_PAGE_SIZE, listingParams } from './listing-query';
import { StargazersService } from './stargazers.service';

/**
 * Everybody who starred one document, a page at a time.
 *
 * The whole list is public, page one and page nine alike. That is the legacy
 * bug this page exists to close: there the view rendered for any visitor while
 * the endpoint it paged with was authentication-gated.
 *
 * The list is the one a *published* document has, so this is the page for that
 * document's stargazers and the site's own 404 for every other state of it —
 * see `missing` below.
 */
@Component({
  selector: 'web-stargazers-page',
  imports: [
    EmptyState,
    LgAvatar,
    LgPaginator,
    NotFoundPage,
    RouterLink,
    SectionError,
    TranslateDirective
  ],
  templateUrl: './stargazers-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StargazersPage {
  private readonly stargazers = inject(StargazersService);
  private readonly content = inject(CommunityDocumentService);
  private readonly router = inject(Router);

  protected readonly links = inject(SiteLinks);
  protected readonly listing = this.stargazers.listing;
  protected readonly document = this.content.document;

  /**
   * Whether this URL is the site's own 404. Two states answer so, and they are
   * one fact from two sides: a link that resolved to nothing, and a document
   * the community does not list.
   *
   * The list is public-only — the API's stargazer read asks for `visibility =
   * 'public'`, the way every listing does — while the document guard admits two
   * states it does not: an unlisted document, for whoever was handed its link,
   * and a private one, for its owner alone. Heading those with the document and
   * then offering a retry for a read that can never succeed would leave a page
   * whose only content is an action with no outcome, and it would name a
   * document nobody published. The owner of a private one is not an exception:
   * there is no list for them either.
   *
   * A read of the document that *failed* is deliberately not this. Nothing is
   * known about the document yet, so the retry is the honest thing to offer —
   * which is what the order of the template's branches is for.
   */
  protected readonly missing = computed(() => {
    const document = this.document();
    return document ? document.visibility !== 'public' : this.content.missing();
  });

  protected readonly documentFailureKey = this.content.failureKey;
  protected readonly documentRetrying = this.content.retrying;
  protected readonly page = this.stargazers.page;
  protected readonly pageCount = this.stargazers.pageCount;
  protected readonly pageSize = STARGAZER_PAGE_SIZE;

  protected readonly documentHref = computed(() => {
    const document = this.document();
    return document
      ? this.links.communityDocument(document.kind, document.link)
      : '';
  });

  protected readonly path = computed(() => {
    const document = this.document();
    return document
      ? this.links.communityStargazers(document.kind, document.link)
      : '';
  });

  protected readonly rows = computed(() =>
    (this.listing.entries() ?? []).map((author) => ({
      id: author.id,
      name: author.username,
      avatar: author.avatar,
      href: this.links.communityUser(author.id)
    }))
  );

  protected async toPage(page: number): Promise<void> {
    await this.router.navigate([this.path()], {
      queryParams: listingParams({ page })
    });
  }

  protected retry(): Promise<void> {
    return this.listing.retry();
  }

  protected retryDocument(): Promise<void> {
    return this.content.retry();
  }
}
