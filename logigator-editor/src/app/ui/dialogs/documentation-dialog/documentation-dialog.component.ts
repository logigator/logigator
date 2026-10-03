import { HttpClient } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  LgButton,
  LgDialogContent,
  LgIconField,
  LgInputIcon,
  LgInputText,
  LgMarkdown,
  LgMarkdownLinkClick,
  LgNavigation,
  LgTextMatcher,
  NavigationItem
} from '@logigator/ui';
import { catchError, of, switchMap, tap } from 'rxjs';
import {
  DEFAULT_DOC_PAGE,
  DOC_SECTIONS,
  docImages,
  DocsSearchHit,
  isDocPageId,
  matchRanges,
  parseDocsLink,
  searchTerms
} from '@logigator/docs';
import {
  DOC_PAGE_TITLES,
  DOC_SECTION_TITLES
} from '../../../documentation/docs-pages';
import { DocsSearchResultsComponent } from './docs-search-results.component';
import { DocsSearchService } from '../../../documentation/docs-search.service';
import { DocumentationService } from '../../../documentation/documentation.service';
import { LayoutService } from '../../../layout/layout.service';
import { TranslationService } from '../../../translation/translation.service';
import { TranslateDirective } from '../../../translation/translate.directive';

/**
 * The documentation viewer. Desktop shows the topic tree beside the page; the
 * compact fullscreen presentation drills down instead: topic index first,
 * then the page with a back button.
 *
 * `docs:` links inside the rendered page jump between pages; every other link
 * kind keeps `lg-markdown`'s built-in handling.
 */
@Component({
  selector: 'app-documentation-dialog',
  imports: [
    DocsSearchResultsComponent,
    LgButton,
    LgIconField,
    LgInputIcon,
    LgInputText,
    LgMarkdown,
    LgNavigation,
    NgTemplateOutlet,
    TranslateDirective
  ],
  templateUrl: './documentation-dialog.component.html',
  host: {
    class: 'flex min-h-0 grow flex-col'
  }
})
export class DocumentationDialogComponent extends LgDialogContent {
  protected readonly docs = inject(DocumentationService);
  protected readonly search = inject(DocsSearchService);
  protected readonly layout = inject(LayoutService);
  private readonly http = inject(HttpClient);
  private readonly translation = inject(TranslationService);
  private readonly injector = inject(Injector);

  private readonly contentPane =
    viewChild<ElementRef<HTMLElement>>('contentPane');
  private readonly markdownView = viewChild(LgMarkdown);

  /** Page shown in the content pane. */
  protected readonly activePage = computed(
    () => this.docs.page() ?? DEFAULT_DOC_PAGE
  );
  /** Compact-only: no page requested yet, so the topic index fills the view. */
  protected readonly showIndex = computed(
    () => this.layout.isCompact() && this.docs.page() === null
  );

  protected readonly navItems = computed<NavigationItem[]>(() =>
    DOC_SECTIONS.map((section) => ({
      id: section.id,
      label: this.translation.translate(DOC_SECTION_TITLES[section.id]),
      items: section.pages.map((page) => ({
        id: page,
        label: this.translation.translate(DOC_PAGE_TITLES[page])
      }))
    }))
  );

  protected readonly pageTitle = computed(() =>
    this.translation.translate(DOC_PAGE_TITLES[this.activePage()])
  );

  protected readonly markdown = signal<string | null>(null);
  protected readonly failed = signal(false);
  /**
   * The markdown view whose body is in the DOM, so a heading can be found in
   * it. The instance rather than a flag: the results replace the content pane,
   * so a result opening the page already shown tears the view down and builds
   * it again, and only the one that reported itself rendered has headings.
   */
  private readonly renderedView = signal<LgMarkdown | null>(null);
  /**
   * Hashed screenshot URLs replacing the authored `./images/…` paths: the
   * active language's, falling back per picture to the English capture.
   */
  protected readonly docImages = computed(() =>
    docImages(this.translation.activeLang())
  );

  /** What a result was opened for, marked in the page it opened. */
  protected readonly highlightMatches = computed<LgTextMatcher | undefined>(
    () => {
      const terms = this.docs.terms();
      return terms.length
        ? (text: string) => matchRanges(text, terms)
        : undefined;
    }
  );

  constructor() {
    super();
    // The viewer opens on the index or the default page, so it opens on no
    // query either; the field is part of this dialog, not of the session.
    inject(DestroyRef).onDestroy(() => this.search.clear());

    toObservable(this.activePage)
      .pipe(
        tap(() => {
          this.markdown.set(null);
          this.failed.set(false);
          this.renderedView.set(null);
        }),
        switchMap((page) =>
          this.http
            .get(this.docs.resolveUrl(page), { responseType: 'text' })
            .pipe(catchError(() => of(null)))
        ),
        takeUntilDestroyed()
      )
      .subscribe((md) => {
        if (md === null) {
          this.failed.set(true);
          return;
        }
        this.markdown.set(md);
        if (this.docs.anchor() === null) {
          this.afterRender(() =>
            this.contentPane()?.nativeElement.scrollTo(0, 0)
          );
        }
      });

    // Applies a pending deep-link anchor once its page is rendered. It waits
    // for the renderer rather than for the markdown: the content is assigned
    // asynchronously, so at the moment the text arrives there is no heading in
    // the DOM to find yet. Waiting for *this* view's render is what carries an
    // anchor into a page the viewer already shows, whose markdown never
    // reloads.
    effect(() => {
      const anchor = this.docs.anchor();
      const view = this.markdownView();
      const rendered = this.renderedView();
      if (anchor === null || view === undefined || view !== rendered) {
        return;
      }
      view.scrollToHeading(anchor);
      this.docs.clearAnchor();
    });
  }

  protected onSearchInput(event: Event): void {
    this.search.search((event.target as HTMLInputElement).value);
  }

  /** Opens the page a result names, at the heading it was found under. */
  protected onResultSelect(hit: DocsSearchHit): void {
    // Read before the open, which ends the search the terms come from.
    const terms = searchTerms(this.search.query());
    this.docs.open(hit.page, hit.anchor ?? undefined, terms);
  }

  protected onNavSelect(id: string | undefined): void {
    if (id !== undefined && isDocPageId(id)) {
      this.docs.open(id);
    }
  }

  protected backToIndex(): void {
    this.docs.showIndex();
  }

  protected onLinkClick(link: LgMarkdownLinkClick): void {
    const target = parseDocsLink(link.href);
    if (!target) {
      return;
    }
    link.preventDefault();
    if (isDocPageId(target.page)) {
      this.docs.open(target.page, target.anchor);
    }
  }

  protected onRendered(view: LgMarkdown): void {
    this.renderedView.set(view);
  }

  /** Runs `fn` after the pending render, so the markdown DOM is queryable. */
  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}
