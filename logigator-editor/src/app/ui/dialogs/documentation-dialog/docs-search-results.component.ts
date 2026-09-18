import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output
} from '@angular/core';
import {
  DocsSearchHit,
  DocsTextPart,
  highlight,
  searchTerms
} from '@logigator/docs';
import { DocsSearchService } from '../../../documentation/docs-search.service';
import { DOC_PAGE_TITLES } from '../../../documentation/docs-pages';
import { TranslationService } from '../../../translation/translation.service';
import { TranslateDirective } from '../../../translation/translate.directive';

/** A hit with the strings the list draws it from resolved. */
interface ResultRow extends DocsSearchHit {
  pageTitleParts: DocsTextPart[];
}

/**
 * The search results, in place of the page the viewer would otherwise show.
 *
 * A row is a heading rather than a page: eleven pages would be a list of the
 * navigation tree, where what a reader is after is the paragraph.
 */
@Component({
  selector: 'app-docs-search-results',
  imports: [TranslateDirective],
  templateUrl: './docs-search-results.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocsSearchResultsComponent {
  private readonly translation = inject(TranslationService);
  protected readonly search = inject(DocsSearchService);

  /** A result was chosen; the viewer opens the page and the anchor. */
  public readonly resultSelected = output<DocsSearchHit>();

  protected readonly rows = computed<ResultRow[]>(() => {
    // The page's name is shown under the heading and can be the only thing a
    // term matched, so it is marked like everything else. The terms come from
    // the query rather than the hit: what is drawn is this app's own title for
    // the page, not the heading the markdown carries.
    const terms = searchTerms(this.search.query());
    return this.search.hits().map((hit) => ({
      ...hit,
      pageTitleParts: highlight(
        this.translation.translate(DOC_PAGE_TITLES[hit.page]),
        terms
      )
    }));
  });
}
