import {
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  ViewEncapsulation
} from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';
import { ImageZoomViewer } from '../image-zoom/image-zoom-viewer';

/**
 * Rewrites markdown link/image destinations to their mapped URLs. Only the
 * destination matches, verbatim; an optional title is carried over and
 * unmapped destinations stay untouched.
 */
export function resolveMarkdownUrls(
  data: string | undefined,
  urls: Readonly<Record<string, string>> | undefined
): string | undefined {
  if (data === undefined || urls === undefined) {
    return data;
  }
  return data.replace(
    /\]\(([^)\s]+)([^)]*)\)/g,
    (match, destination: string, title: string) =>
      Object.hasOwn(urls, destination)
        ? `](${urls[destination]}${title})`
        : match
  );
}

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
  template: `<markdown [data]="resolvedData()" [src]="src()" />`,
  styles: `
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

  protected readonly resolvedData = computed(() =>
    resolveMarkdownUrls(this.data(), this.assetUrls())
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly imageZoom = inject(ImageZoomViewer);

  constructor() {
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

  /** Scrolls the rendered heading whose {@link headingSlug} matches into view. */
  scrollToHeading(slug: string): void {
    const headings = this.host.nativeElement.querySelectorAll<HTMLElement>(
      'h1, h2, h3, h4, h5, h6'
    );
    Array.from(headings)
      .find((heading) => headingSlug(heading.textContent ?? '') === slug)
      ?.scrollIntoView({ block: 'start' });
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
      const slug = href.slice(1);
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

/** Schemes the user agent handles without unloading the app. */
const NATIVE_SCHEMES: ReadonlySet<string> = new Set(['mailto', 'tel', 'sms']);
