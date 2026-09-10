import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DOC_SECTIONS } from '@logigator/docs';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { DOC_PAGE_TITLES, DOC_SECTION_TITLES } from './doc-titles';
import { DocsSearchField } from './docs-search-field';
import { DocsSearchResults } from './docs-search-results';
import { DocsSearchService } from './docs-search.service';

/**
 * The documentation index: every section and the pages under it.
 *
 * It is the whole tree rather than a summary, because below the sidebar's
 * breakpoint it is the only navigation the documentation has. It is also where
 * search results are shown, `?q=` naming the query — the one place on the site
 * wide enough for them, and the page a field beside a document submits to.
 */
@Component({
  selector: 'web-docs-index-page',
  imports: [DocsSearchField, DocsSearchResults, RouterLink, TranslateDirective],
  templateUrl: './docs-index-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocsIndexPage {
  private readonly links = inject(SiteLinks);
  protected readonly search = inject(DocsSearchService);

  /**
   * The query the URL names. The field writes it back debounced, so this also
   * carries a shared link, a reload and the browser's back button into the
   * field rather than only out of it.
   */
  private readonly queryParam = toSignal(inject(ActivatedRoute).queryParamMap);

  protected readonly sections = DOC_SECTIONS;
  protected readonly sectionTitles = DOC_SECTION_TITLES;
  protected readonly pageTitles = DOC_PAGE_TITLES;

  constructor() {
    // The URL's query, into the field — a shared link, a reload, the back
    // button. Only the URL: the field itself answers a keystroke directly, and
    // an effect that also depended on the query would run on every one of them
    // and put the URL's older value back, leaving the results to wait for the
    // debounced write.
    effect(() => {
      const query = this.queryParam()?.get('q') ?? '';
      if (query !== untracked(this.search.query)) {
        this.search.search(query);
      }
    });
  }

  /** Every page's path, in one computed; see `DocsNav`. */
  protected readonly hrefs = computed(() =>
    Object.fromEntries(
      DOC_SECTIONS.flatMap((section) =>
        section.pages.map((page) => [page, this.links.docsPage(page)])
      )
    )
  );
}
