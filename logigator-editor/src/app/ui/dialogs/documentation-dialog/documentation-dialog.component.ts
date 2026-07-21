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
import { TranslocoDirective } from '@jsverse/transloco';
import {
  LgButton,
  LgDialogContent,
  LgMarkdown,
  LgNavigation,
  NavigationItem
} from '@logigator/ui';
import { catchError, of, switchMap, tap } from 'rxjs';
import { classifyDocLink, headingSlug } from '../../../documentation/doc-link';
import { DOC_IMAGES } from '../../../documentation/docs-images';
import {
  DEFAULT_DOC_PAGE,
  DOC_SECTIONS,
  docPage,
  isDocPageId
} from '../../../documentation/docs-pages';
import { DocumentationService } from '../../../documentation/documentation.service';
import { LayoutService } from '../../../layout/layout.service';
import { TranslationService } from '../../../translation/translation.service';

/**
 * The documentation viewer, reached from the Help menu or any deep link
 * ({@link DocumentationService.open}). Desktop shows the topic tree beside the
 * page; the compact fullscreen presentation drills down instead — topic index
 * first, then the page with a back button.
 *
 * Clicks inside the rendered page are intercepted: `docs:` links jump between
 * pages, `#` links scroll to a heading, external links open a new tab.
 */
@Component({
  selector: 'app-documentation-dialog',
  imports: [
    LgButton,
    LgMarkdown,
    LgNavigation,
    NgTemplateOutlet,
    TranslocoDirective
  ],
  templateUrl: './documentation-dialog.component.html',
  // The click listener delegates for anchors in the rendered markdown (there
  // is no component to attach to inside `innerHTML` content); anchors stay
  // keyboard-accessible on their own — Enter fires a bubbling click.
  host: {
    class: 'flex min-h-0 grow flex-col',
    '(click)': 'onContentClick($event)'
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

  /** Page shown in the content pane; the default while none is requested. */
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
  /** Hashed screenshot URLs, swapped in for the authored `images/…` paths. */
  protected readonly docImages = DOC_IMAGES;

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

  protected onContentClick(event: MouseEvent): void {
    const link = (event.target as HTMLElement | null)?.closest('a');
    if (!link) {
      return;
    }
    const target = classifyDocLink(link.getAttribute('href'));
    switch (target.kind) {
      case 'page':
        event.preventDefault();
        if (isDocPageId(target.page)) {
          this.docs.open(target.page, target.anchor);
        }
        break;
      case 'anchor':
        event.preventDefault();
        this.scrollToAnchor(target.anchor);
        break;
      case 'external':
        event.preventDefault();
        window.open(target.url, '_blank', 'noopener');
        break;
      case 'none':
        break;
    }
  }

  private scrollToAnchor(anchor: string): void {
    this.afterRender(() => {
      const pane = this.contentPane()?.nativeElement;
      if (!pane) {
        return;
      }
      const headings = pane.querySelectorAll<HTMLElement>('h1, h2, h3, h4');
      const match = Array.from(headings).find(
        (heading) => headingSlug(heading.textContent ?? '') === anchor
      );
      match?.scrollIntoView({ block: 'start' });
    });
  }

  /** Runs `fn` after the pending render, so the markdown DOM is queryable. */
  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}
