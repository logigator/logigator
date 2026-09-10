import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  viewChild
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  isDocPageId,
  matchRanges,
  parseDocsLink,
  searchTerms
} from '@logigator/docs';
import { LgMarkdown, LgMarkdownLinkClick, LgTextMatcher } from '@logigator/ui';
import { SiteLinks } from '../../layout/site-links';
import { TranslateDirective } from '../../translation/translate.directive';
import { TranslationService } from '../../translation/translation.service';
import { docDestinations } from './doc-destinations';
import { DocsContentService } from './docs-content.service';
import { DocsRouteData } from './docs-route-data';
import { DocsNav } from './docs-nav';

/**
 * One documentation page: the topic tree beside the prose the route resolved.
 *
 * The page draws no heading of its own — the markdown opens with its own `# …`,
 * localized with the rest of the body, and a second one would leave the
 * document with two names. The route's title key names the page in the tab, in
 * the navigation and in the breadcrumb trail, where a label may not wait for a
 * body to load.
 */
@Component({
  selector: 'web-doc-page',
  imports: [DocsNav, LgMarkdown, RouterLink, TranslateDirective],
  templateUrl: './doc-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPage {
  private readonly content = inject(DocsContentService);
  private readonly translation = inject(TranslationService);
  private readonly router = inject(Router);
  private readonly links = inject(SiteLinks);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly markdownView = viewChild(LgMarkdown);

  /**
   * From the route snapshot: the language can change under this page, but the
   * page it names cannot — that is a different route.
   */
  protected readonly page = (this.route.snapshot.data as DocsRouteData).docPage;

  protected readonly markdown = this.content.markdown(this.page);

  /** The heading a URL, or a search result, asks for. */
  private readonly fragment = toSignal(this.route.fragment);

  /**
   * What a reader arriving from a search was looking for, marked in the body.
   * It rides in the URL rather than in the search service's memory, so a
   * reloaded or a shared link shows the same marks the result click did.
   */
  private readonly queryParam = toSignal(this.route.queryParamMap);
  protected readonly highlightMatches = computed<LgTextMatcher | undefined>(
    () => {
      const terms = searchTerms(this.queryParam()?.get('q') ?? '');
      return terms.length
        ? (text: string) => matchRanges(text, terms)
        : undefined;
    }
  );
  private readonly rendered = signal(false);

  constructor() {
    // The renderer emits no heading ids, so the router's own anchor scrolling
    // finds nothing: a fragment resolves against the slug of a heading's own
    // text, which is what `scrollToHeading` matches. It runs off `ready`, the
    // renderer assigning its content asynchronously — before that there is no
    // heading to find — and never on the server, which has nothing to scroll.
    effect(() => {
      const fragment = this.fragment();
      if (!fragment || !this.rendered() || !this.isBrowser) {
        return;
      }
      this.markdownView()?.scrollToHeading(decodeURIComponent(fragment));
    });
  }

  /** The body is in the DOM, so a heading can be found in it. */
  protected onRendered(): void {
    this.rendered.set(true);
  }

  protected readonly indexHref = this.links.docs;

  /**
   * The authored destinations as this site's URLs: the hashed screenshots, and
   * a `docs:` cross link as the route its page is served at.
   */
  protected readonly destinations = computed(() =>
    docDestinations(this.translation.activeLang(), (page) =>
      this.links.docsPage(page)
    )
  );

  /**
   * Claims a link the rewrite turned into one of this app's own paths, so
   * following it is a navigation rather than the renderer's own "open in a new
   * tab" handling for a link with no scheme. A `docs:` href that survived the
   * rewrite carries an anchor; it is routed the same way.
   */
  protected onLinkClick(link: LgMarkdownLinkClick): void {
    const target = parseDocsLink(link.href);
    if (target) {
      link.preventDefault();
      if (isDocPageId(target.page)) {
        void this.router.navigate([this.links.docsPage(target.page)], {
          fragment: target.anchor
        });
      }
      return;
    }
    if (link.href.startsWith('/')) {
      link.preventDefault();
      void this.router.navigateByUrl(link.href);
    }
  }
}
