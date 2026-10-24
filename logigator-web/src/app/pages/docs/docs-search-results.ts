import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  DocsSearchHit,
  DocsTextPart,
  highlight,
  searchTerms
} from '@logigator/docs';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { DOC_PAGE_TITLES } from './doc-titles';
import { DocsSearchService } from './docs-search.service';

/** A hit with the strings and the destination the list draws it from. */
interface ResultRow extends DocsSearchHit {
  pageTitleParts: DocsTextPart[];
  href: string;
}

/**
 * The results, in place of the index's contents list.
 *
 * A row is a heading rather than a page, and it is an anchor: a result is a
 * URL on this site like every other destination, so it opens in a new tab,
 * copies, and reads as a link.
 */
@Component({
  selector: 'web-docs-search-results',
  imports: [RouterLink, TranslateDirective],
  templateUrl: './docs-search-results.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocsSearchResults {
  private readonly translation = inject(TranslationService);
  private readonly links = inject(SiteLinks);
  protected readonly search = inject(DocsSearchService);

  protected readonly rows = computed<ResultRow[]>(() => {
    // The page's name is shown beside the heading and can be the only thing a
    // term matched, so it is marked like everything else. The terms come from
    // the query rather than the hit: what is drawn is this app's own title for
    // the page, not the heading the markdown carries.
    const terms = searchTerms(this.search.query());
    return this.search.hits().map((hit) => ({
      ...hit,
      pageTitleParts: highlight(
        this.translation.translate(DOC_PAGE_TITLES[hit.page]),
        terms
      ),
      href: this.links.docsPage(hit.page)
    }));
  });
}
