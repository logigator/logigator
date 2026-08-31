import { HttpClient } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
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
  LgMarkdown,
  LgMarkdownLinkClick,
  LgNavigation,
  NavigationItem
} from '@logigator/ui';
import { catchError, of, switchMap, tap } from 'rxjs';
import { parseDocsLink } from '../../../documentation/doc-link';
import { docImages } from '../../../documentation/docs-images';
import {
  DEFAULT_DOC_PAGE,
  DOC_SECTIONS,
  docPage,
  isDocPageId
} from '../../../documentation/docs-pages';
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
    LgButton,
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
      label: this.translation.translate(section.titleKey),
      items: section.pages.map((page) => ({
        id: page.id,
        label: this.translation.translate(page.titleKey)
      }))
    }))
  );

  protected readonly pageTitle = computed(() =>
    this.translation.translate(docPage(this.activePage()).titleKey)
  );

  protected readonly markdown = signal<string | null>(null);
  protected readonly failed = signal(false);
  /**
   * Hashed screenshot URLs replacing the authored `./images/…` paths: the
   * active language's, falling back per picture to the English capture.
   */
  protected readonly docImages = computed(() =>
    docImages(this.translation.activeLang())
  );

  constructor() {
    super();
    toObservable(this.activePage)
      .pipe(
        tap(() => {
          this.markdown.set(null);
          this.failed.set(false);
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

    // Applies a pending deep-link anchor once its page's markdown is in.
    effect(() => {
      const anchor = this.docs.anchor();
      if (anchor === null || this.markdown() === null) {
        return;
      }
      this.scrollToAnchor(anchor);
      this.docs.clearAnchor();
    });
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

  private scrollToAnchor(anchor: string): void {
    this.afterRender(() => this.markdownView()?.scrollToHeading(anchor));
  }

  /** Runs `fn` after the pending render, so the markdown DOM is queryable. */
  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}
