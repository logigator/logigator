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
 * Replaces markdown link/image destinations with their mapped URLs. Only the
 * destination part matches, verbatim (an optional title is carried over);
 * destinations without a mapping stay untouched.
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
 * The anchor slug of a heading, derived from its text (lowercased,
 * non-alphanumeric runs collapsed to `-`). marked no longer emits heading ids,
 * so anchors resolve against rendered heading text.
 */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Width-to-height ratio below which an image lays out as a portrait aside:
 * the height cap every image gets — so one tall screenshot can't push the
 * prose off the page — leaves a portrait image narrow, and the text reads
 * beside it rather than around a column of whitespace. Wide viewports only;
 * a narrow one has no room alongside. Detail lost to the cap is the built-in
 * image zoom's to give back.
 */
const PORTRAIT_MAX_RATIO = 0.9;

/** A click on a link inside rendered markdown content. */
export interface LgMarkdownLinkClick {
  /** The href as rendered into the DOM. */
  href: string;
  /** The anchor element the click landed on. */
  anchor: HTMLAnchorElement;
  /** Claims the click: cancels the built-in handling and native navigation. */
  preventDefault(): void;
}

/**
 * Themed markdown renderer. Wraps ngx-markdown's `<markdown>` (parsing via
 * `marked`) and layers a typography treatment keyed on the `--lg-*` palette, so
 * rendered content matches the rest of the UI in either theme.
 *
 * Provide exactly one source: `data` for an in-memory string, or `src` for a
 * URL/asset path the renderer fetches itself (requires `provideMarkdown` with an
 * `HttpClient` loader in the consuming app).
 *
 * Link clicks inside the rendered content are intercepted (the content is
 * `innerHTML`, so a host-level listener delegates; anchors stay
 * keyboard-accessible on their own — Enter fires a bubbling click). Every click
 * emits `linkClick` first; unless the handler claims it via `preventDefault()`,
 * built-in handling applies: `#slug` scrolls to the matching heading, web and
 * relative URLs open a new tab with `noopener`, user-agent schemes (`mailto:`,
 * `tel:`, `sms:`) navigate natively, and any other scheme does nothing —
 * app-specific links are claim-or-inert, and `javascript:` payloads (rendered
 * with the HTML sanitizer's `unsafe:` prefix as their scheme) stay defused.
 *
 * Content images open full-size in a modal overlay when clicked (the zoom
 * `LgImageZoom` gives a standalone image — content images can't host a
 * component, so the behavior is delegated from the host like link clicks, and
 * each image becomes a focusable button — named by its alt text — as it
 * loads). An image wrapped in a link keeps the link's behavior instead.
 *
 * Uses `ViewEncapsulation.None` because ngx-markdown injects the parsed HTML as
 * `innerHTML` on its own element, out of reach of emulated encapsulation; every
 * rule is therefore scoped under the `lg-markdown` host element.
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

    /* Portrait images are narrow once height-capped, so the prose reads beside
       them instead of around a column of whitespace — see PORTRAIT_MAX_RATIO. */
    @media (min-width: 36rem) {
      lg-markdown img.lg-portrait {
        float: right;
        margin-left: 0.75rem;
      }

      /* A float shortens the line boxes beside it but not the boxes
         themselves, so a rule or fill would run on under the image. Blocks
         that paint one end beside it instead: a block formatting context may
         not overlap a float. Prose keeps flowing around. */
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
   * Maps link/image destinations authored in the markdown to the URLs they
   * resolve to at runtime — e.g. relative screenshot paths to build-hashed
   * asset imports. Destinations match verbatim; unmapped ones pass through.
   * Applies to `data` only: content fetched via `src` renders as-is.
   */
  readonly assetUrls = input<Readonly<Record<string, string>>>();
  /**
   * A click on any link in the rendered content, emitted before the built-in
   * handling. `preventDefault()` on the event claims the click — e.g. for an
   * app-specific scheme the consumer routes itself.
   */
  readonly linkClick = output<LgMarkdownLinkClick>();

  protected readonly resolvedData = computed(() =>
    resolveMarkdownUrls(this.data(), this.assetUrls())
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly imageZoom = inject(ImageZoomViewer);

  constructor() {
    // Per-image setup hangs off each image's `load` event (`load` doesn't
    // bubble, hence the capture phase) — the content is innerHTML, so there is
    // no other per-image hook, and re-rendered content fires it again, cache
    // included. Only the image itself knows its aspect ratio (CSS can't ask),
    // so the portrait class the layout keys off is set here; so is the
    // focusability the built-in zoom needs.
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
          // The button role announces that Enter does something; the image's
          // alt text serves as the button's accessible name.
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
      // no native meaning, and javascript: payloads (reaching here with the
      // sanitizer's unsafe: prefix as their scheme) must never execute.
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
