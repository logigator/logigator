import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  ViewEncapsulation
} from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { ImageZoomViewer } from '../image-zoom/image-zoom-viewer';
import { resolveMarkdownUrls } from '../../internal/markdown-urls';

/**
 * A heading's anchor slug, derived from its text: marked emits no heading ids,
 * so anchors resolve against the rendered text.
 */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Width-to-height ratio below which an image floats as a portrait aside on
 * wide viewports. The height cap every image carries leaves such an image
 * narrow, so the prose reads beside it instead of around whitespace.
 */
const PORTRAIT_MAX_RATIO = 0.9;

/** Where a match sits in a string, in the UTF-16 units a text node counts in. */
export interface LgTextRange {
  start: number;
  end: number;
}

/**
 * Finds what should be marked inside one run of rendered text. A function
 * rather than a list of words, so the rule for what counts as a match — case,
 * accents, whatever a consumer's search folds away — stays with the consumer.
 */
export type LgTextMatcher = (text: string) => readonly LgTextRange[];

/**
 * The registry name the marks are set under. One name, so `::highlight()` can
 * be written in a stylesheet at all — which means one rendered document at a
 * time carries marks, and that is all either viewer shows.
 */
const HIGHLIGHT_NAME = 'lg-markdown-match';

/** Whether this browser can mark text without the content being rewritten. */
function highlightsSupported(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    'highlights' in CSS &&
    typeof Highlight !== 'undefined'
  );
}

/** A click on a link inside rendered markdown content. */
export interface LgMarkdownLinkClick {
  href: string;
  anchor: HTMLAnchorElement;
  /** Claims the click: cancels the built-in handling and native navigation. */
  preventDefault(): void;
}

/**
 * Themed markdown renderer over ngx-markdown's `<markdown>`, with typography
 * keyed on the `--lg-*` palette.
 *
 * Provide exactly one source: `data` for an in-memory string, or `src` for a
 * path the renderer fetches (needs `provideMarkdown` with an `HttpClient`
 * loader in the consuming app).
 *
 * Every link click emits `linkClick` first. Unless the handler claims it,
 * `#slug` scrolls to the matching heading, web and relative URLs open a new
 * tab with `noopener`, `mailto:`/`tel:`/`sms:` navigate natively, and any
 * other scheme does nothing — so app-specific links are claim-or-inert and
 * `javascript:` payloads stay defused. Content images open full-size in a
 * modal overlay; one wrapped in a link keeps the link's behavior.
 *
 * `ViewEncapsulation.None` because the parsed HTML lands as `innerHTML` on
 * ngx-markdown's element, out of reach of emulated encapsulation; every rule
 * is therefore scoped under the `lg-markdown` host.
 */
@Component({
  selector: 'lg-markdown',
  imports: [MarkdownComponent],
  encapsulation: ViewEncapsulation.None,
  providers: [ImageZoomViewer],
  host: {
    '(click)': 'onContentClick($event)',
    '(keydown)': 'onContentKeydown($event)'
  },
  template: `<markdown
    [data]="resolvedData()"
    [src]="src()"
    (ready)="onRendered()"
  />`,
  styles: `
    /* Only a handful of properties are allowed here; background and colour are
       what a mark needs. Matches the results list's own marking. */
    ::highlight(lg-markdown-match) {
      background-color: color-mix(in srgb, var(--lg-primary) 25%, transparent);
      color: inherit;
    }

    lg-markdown {
      display: block;
      color: var(--lg-text);
      font-size: 0.9375rem;
      line-height: 1.6;
    }

    lg-markdown h1,
    lg-markdown h2,
    lg-markdown h3,
    lg-markdown h4 {
      font-weight: 700;
      line-height: 1.25;
      color: var(--lg-text);
    }

    lg-markdown h1 {
      font-size: 1.5rem;
      margin: 0 0 1rem;
    }

    lg-markdown h2 {
      font-size: 1.25rem;
      margin: 1.75rem 0 0.75rem;
      padding-bottom: 0.35rem;
      border-bottom: 1px solid var(--lg-border);
    }

    lg-markdown h3 {
      font-size: 1.0625rem;
      margin: 1.5rem 0 0.5rem;
    }

    lg-markdown h4 {
      font-size: 0.9375rem;
      margin: 1.25rem 0 0.5rem;
      color: var(--lg-content);
    }

    lg-markdown > :first-child {
      margin-top: 0;
    }

    lg-markdown > :last-child {
      margin-bottom: 0;
    }

    lg-markdown p {
      margin: 0 0 0.75rem;
    }

    lg-markdown ul,
    lg-markdown ol {
      margin: 0 0 0.75rem;
      padding-left: 1.5rem;
    }

    lg-markdown ul {
      list-style: disc outside;
    }

    lg-markdown ol {
      list-style: decimal outside;
    }

    lg-markdown li {
      margin: 0.25rem 0;
    }

    lg-markdown li::marker {
      color: var(--lg-muted);
    }

    lg-markdown a {
      color: var(--lg-primary);
      text-decoration: none;
    }

    lg-markdown a:hover {
      text-decoration: underline;
    }

    lg-markdown strong {
      font-weight: 700;
    }

    lg-markdown em {
      font-style: italic;
    }

    lg-markdown code {
      font-family: var(--font-mono, monospace);
      font-size: 0.85em;
      background: var(--lg-content-hover);
      border-radius: 0.25rem;
      padding: 0.1em 0.35em;
    }

    lg-markdown pre {
      background: var(--lg-content-hover);
      border: 1px solid var(--lg-border);
      border-radius: 0.5rem;
      padding: 0.75rem 1rem;
      overflow-x: auto;
      margin: 0 0 0.75rem;
    }

    lg-markdown pre code {
      background: none;
      padding: 0;
      font-size: 0.85rem;
    }

    lg-markdown blockquote {
      margin: 0 0 0.75rem;
      padding: 0.25rem 0 0.25rem 1rem;
      border-left: 3px solid var(--lg-border);
      color: var(--lg-muted);
    }

    lg-markdown blockquote > :last-child {
      margin-bottom: 0;
    }

    lg-markdown hr {
      border: none;
      border-top: 1px solid var(--lg-border);
      margin: 1.5rem 0;
    }

    lg-markdown table {
      border-collapse: collapse;
      margin: 0 0 0.75rem;
      width: 100%;
    }

    lg-markdown th,
    lg-markdown td {
      border: 1px solid var(--lg-border);
      padding: 0.35rem 0.6rem;
      text-align: left;
    }

    lg-markdown th {
      background: var(--lg-content-hover);
      font-weight: 700;
    }

    lg-markdown img {
      display: block;
      max-width: 100%;
      max-height: 24rem;
      margin: auto;
      cursor: zoom-in;
    }

    /* An image wrapped in a link acts as the link, not as a zoom trigger. */
    lg-markdown a img {
      cursor: pointer;
    }

    @media (min-width: 36rem) {
      lg-markdown img.lg-portrait {
        float: right;
        margin-left: 0.75rem;
      }

      /* A float shortens the line boxes beside it but not the boxes
         themselves, so a rule or fill would run on under the image. A block
         formatting context may not overlap a float; prose keeps flowing. */
      lg-markdown h1,
      lg-markdown h2,
      lg-markdown h3,
      lg-markdown h4,
      lg-markdown pre,
      lg-markdown blockquote,
      lg-markdown hr {
        display: flow-root;
      }
    }
  `
})
export class LgMarkdown {
  /** Markdown string to render in place. */
  readonly data = input<string>();
  /** URL/asset path the renderer fetches and renders. */
  readonly src = input<string>();
  /**
   * Maps authored link/image destinations to their runtime URLs, e.g.
   * relative screenshot paths to build-hashed asset imports. Applies to
   * `data` only; content fetched via `src` renders as-is.
   */
  readonly assetUrls = input<Readonly<Record<string, string>>>();
  /**
   * A link click, emitted before the built-in handling. `preventDefault()`
   * claims it, e.g. for an app-specific scheme the consumer routes itself.
   */
  readonly linkClick = output<LgMarkdownLinkClick>();
  /**
   * The rendered content is in the DOM. The renderer assigns it asynchronously,
   * so this is the hook anything reading the result needs — {@link
   * scrollToHeading} finds nothing when called before it.
   */
  readonly ready = output<void>();
  /**
   * Marks what it finds in the rendered text — a reader who arrived from a
   * search sees the words that brought them here.
   *
   * Nothing is inserted into the content: the matches become `Range`s in the
   * CSS Custom Highlight API, styled through `::highlight()`. Wrapping them in
   * markup would mean rewriting HTML the renderer owns and re-doing it on
   * every render. Where the API is missing the page simply carries no marks.
   */
  readonly highlightMatches = input<LgTextMatcher>();

  protected readonly resolvedData = computed(() =>
    resolveMarkdownUrls(this.data(), this.assetUrls())
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly imageZoom = inject(ImageZoomViewer);

  constructor() {
    // Re-marked when the matcher changes; `ready` covers the other half, the
    // content itself arriving.
    effect(() => this.markMatches(this.highlightMatches()));
    inject(DestroyRef).onDestroy(() => this.clearMatches());

    // The content is innerHTML, so `load` in the capture phase (it doesn't
    // bubble) is the only per-image hook; re-rendered content fires it again,
    // cache included. Only the image knows its aspect ratio, so the portrait
    // class and the zoom's focusability are set here.
    this.host.nativeElement.addEventListener(
      'load',
      (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement)) {
          return;
        }
        if (image.naturalHeight > 0) {
          image.classList.toggle(
            'lg-portrait',
            image.naturalWidth / image.naturalHeight < PORTRAIT_MAX_RATIO
          );
        }
        // A linked image activates its (already focusable) link instead.
        if (!image.closest('a')) {
          // The role announces that Enter does something; the alt text is the
          // accessible name.
          image.tabIndex = 0;
          image.setAttribute('role', 'button');
        }
      },
      true
    );
  }

  /**
   * Marks every run `find` reports across the rendered text, replacing whatever
   * was marked before. Text nodes are matched one at a time, so a match broken
   * up by inline markup — `**simu**lation` — is found in halves or not at all.
   */
  private markMatches(find: LgTextMatcher | undefined): void {
    if (!highlightsSupported()) {
      return;
    }
    this.clearMatches();
    if (!find) {
      return;
    }
    const walker = document.createTreeWalker(
      this.host.nativeElement,
      NodeFilter.SHOW_TEXT
    );
    const ranges: Range[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue;
      if (!text) {
        continue;
      }
      for (const { start, end } of find(text)) {
        // A range the text cannot carry throws and takes the render with it,
        // so a matcher's offsets are checked rather than trusted.
        if (start < 0 || end > text.length || start >= end) {
          continue;
        }
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        ranges.push(range);
      }
    }
    if (ranges.length > 0) {
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(...ranges));
    }
  }

  private clearMatches(): void {
    if (highlightsSupported()) {
      CSS.highlights.delete(HIGHLIGHT_NAME);
    }
  }

  /** Scrolls the rendered heading whose {@link headingSlug} matches into view. */
  scrollToHeading(slug: string): void {
    const headings = this.host.nativeElement.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, h5, h6'
    );
    Array.from(headings)
      .find((heading) => headingSlug(heading.textContent ?? '') === slug)
      ?.scrollIntoView({ block: 'start' });
  }

  /** The renderer has written its content; anything reading it can run now. */
  protected onRendered(): void {
    this.markMatches(this.highlightMatches());
    this.ready.emit();
  }

  protected onContentClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor || !this.host.nativeElement.contains(anchor)) {
      if (event.target instanceof HTMLImageElement) {
        this.openImage(event.target);
      }
      return;
    }
    const href = anchor.getAttribute('href');
    if (!href) {
      return;
    }
    let claimed = false;
    this.linkClick.emit({
      href,
      anchor,
      preventDefault: () => {
        claimed = true;
        event.preventDefault();
      }
    });
    if (claimed) {
      return;
    }
    if (href.startsWith('#')) {
      event.preventDefault();
      const slug = decodeFragment(href.slice(1));
      if (slug) {
        this.scrollToHeading(slug);
      }
      return;
    }
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
    if (scheme === undefined || scheme === 'http' || scheme === 'https') {
      event.preventDefault();
      window.open(href, '_blank', 'noopener');
    } else if (!NATIVE_SCHEMES.has(scheme)) {
      // Unclaimed non-user-agent schemes stay inert: app-specific links carry
      // no native meaning, and javascript: payloads must never execute.
      event.preventDefault();
    }
  }

  protected onContentKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    if (event.target instanceof HTMLImageElement) {
      event.preventDefault();
      this.openImage(event.target);
    }
  }

  private openImage(image: HTMLImageElement): void {
    this.imageZoom.open(image.currentSrc || image.src, image.alt);
  }
}

/**
 * A fragment as the heading slug it names. The renderer percent-encodes a
 * destination, so a heading whose slug carries a non-ASCII letter — every
 * language but English has them — arrives encoded and would match nothing.
 */
function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    // A stray `%` is not an escape; the slug is what was written.
    return fragment;
  }
}

/** Schemes the user agent handles without unloading the app. */
const NATIVE_SCHEMES: ReadonlySet<string> = new Set(['mailto', 'tel', 'sms']);
