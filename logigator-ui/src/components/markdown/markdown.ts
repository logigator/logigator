import {
  afterRenderEffect,
  booleanAttribute,
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
import {
  LgMarkdownAsset,
  LgMarkdownImage,
  resolveMarkdownUrls
} from '../../internal/markdown-urls';
import {
  LG_PROSE_STYLES,
  LG_USER_PROSE_STYLES
} from '../../internal/prose-styles';
import { renderUserMarkdown } from '../../internal/user-markdown';

/**
 * A heading's anchor slug, derived from its text: what a `#fragment` resolves
 * against for a heading that carries no explicit id.
 */
export function headingSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * `{#id}` closing a heading's text, the authored anchor of the section. Its own
 * text node in practice: the marker comes last on the line, after any markup.
 */
const HEADING_ID = /\s*\{#([^\s{}]+)\}\s*$/;

/** `Node.TEXT_NODE`, which the server's DOM has no global for. */
const TEXT_NODE = 3;

/**
 * Width-to-height ratio below which an image floats as a portrait aside on
 * wide viewports. The height cap every image carries leaves such an image
 * narrow, so the prose reads beside it instead of around whitespace.
 */
const PORTRAIT_MAX_RATIO = 0.9;

function isPortrait(width: number, height: number): boolean {
  return width / height < PORTRAIT_MAX_RATIO;
}

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
 * A heading ending in `{#id}` renders without it and carries the id; anything
 * else is addressed by its {@link headingSlug}. Only authored markdown, never
 * `userContent`, assigns ids.
 *
 * Every link click emits `linkClick` first. Unless the handler claims it,
 * `#anchor` scrolls to the matching heading, web and relative URLs open a new
 * tab with `noopener`, `mailto:`/`tel:`/`sms:` navigate natively, and any
 * other scheme does nothing — so app-specific links are claim-or-inert and
 * `javascript:` payloads stay defused. Content images open full-size in a
 * modal overlay; one wrapped in a link keeps the link's behavior.
 *
 * `ViewEncapsulation.None` because the parsed HTML lands as `innerHTML` on
 * ngx-markdown's element, out of reach of emulated encapsulation; every rule
 * is therefore scoped under the `lg-markdown` host, or under the `.lg-prose`
 * class this shares with the markdown field's editing surface so that what an
 * author writes and what a reader gets are one stylesheet.
 */
@Component({
  selector: 'lg-markdown',
  imports: [MarkdownComponent],
  encapsulation: ViewEncapsulation.None,
  providers: [ImageZoomViewer],
  host: {
    class: 'lg-prose',
    '[attr.data-user-content]': 'userContent() || null',
    '(click)': 'onContentClick($event)',
    '(keydown)': 'onContentKeydown($event)'
  },
  template: `@if (userContent()) {
      <div data-user-content [innerHTML]="userHtml()"></div>
    } @else {
      <markdown [data]="resolvedData()" [src]="src()" (ready)="onRendered()" />
    }`,
  styles: [
    LG_PROSE_STYLES,
    LG_USER_PROSE_STYLES,
    `
      /* Only a handful of properties are allowed here; background and colour are
         what a mark needs. Matches the results list's own marking. */
      ::highlight(lg-markdown-match) {
        background-color: color-mix(
          in srgb,
          var(--lg-primary) 25%,
          transparent
        );
        color: inherit;
      }

      lg-markdown {
        display: block;
      }

      /* An image opens full size, which the editor's surface has no counterpart
         for — an author cannot name one, so there it is not even a cursor. */
      lg-markdown img {
        cursor: zoom-in;
      }

      /* A picture whose size is known takes the box its file would give it
         before the file arrives: natural size, scaled into the column and
         under the height cap with its ratio kept. */
      lg-markdown img.lg-sized {
        aspect-ratio: var(--lg-image-width) / var(--lg-image-height);
        width: min(
          var(--lg-image-width) * 1px,
          100%,
          var(--lg-image-max-height) * var(--lg-image-width) /
            var(--lg-image-height)
        );
        height: auto;
      }

      /* An image wrapped in a link acts as the link, not as a zoom trigger. */
      lg-markdown a img {
        cursor: pointer;
      }

      /* Nothing here opens, so nothing here invites a click. */
      lg-markdown[data-user-content] img {
        cursor: default;
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
  ]
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
   *
   * A picture mapped with its size has its box from the first layout, so
   * nothing below it moves when the file arrives — a heading scrolled to
   * included.
   */
  readonly assetUrls = input<Readonly<Record<string, LgMarkdownAsset>>>();
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
  /**
   * Renders `data` as **text a member wrote**, under the restricted rule in
   * `internal/user-markdown`: raw HTML comes out as text, a link is marked as
   * a visitor's and an image may only be same-origin.
   *
   * It is a different parse, not a filter over the same one, and it is
   * deliberately the consumer's choice rather than something inferred: what
   * makes content trusted is where it came from, which only the consumer
   * knows. Authored documentation renders without it and keeps its own links.
   *
   * Images also stop being zoomable here — an author cannot name one, so a
   * zoom affordance would be a control leading nowhere.
   */
  readonly userContent = input(false, { transform: booleanAttribute });

  protected readonly resolvedData = computed(() =>
    resolveMarkdownUrls(this.data(), this.assetUrls())
  );
  /** The sized pictures among the assets, by the URL they render with. */
  private readonly imageSizes = computed(() => {
    const sizes = new Map<string, LgMarkdownImage>();
    for (const asset of Object.values(this.assetUrls() ?? {})) {
      if (typeof asset !== 'string') {
        sizes.set(asset.url, asset);
      }
    }
    return sizes;
  });
  /**
   * Parsed synchronously, which is what lets a server render carry a member's
   * own words in the first byte. The binding is `[innerHTML]`, so Angular's
   * sanitizer runs over the result as a second layer.
   */
  protected readonly userHtml = computed(() =>
    renderUserMarkdown(this.resolvedData() ?? '')
  );

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly imageZoom = inject(ImageZoomViewer);

  constructor() {
    // Re-marked when the matcher changes; `ready` covers the other half, the
    // content itself arriving.
    effect(() => this.markMatches(this.highlightMatches()));
    inject(DestroyRef).onDestroy(() => this.clearMatches());

    // The user-content branch writes through a binding rather than through
    // ngx-markdown, so there is no `(ready)` to forward and this is that
    // signal's other half. After the render, so the content is findable; never
    // on the server, where nothing reads it.
    afterRenderEffect(() => {
      if (!this.userContent()) {
        return;
      }
      this.userHtml();
      this.onRendered();
    });

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
            isPortrait(image.naturalWidth, image.naturalHeight)
          );
        }
        // A linked image activates its (already focusable) link instead, and
        // an author's image opens nothing at all.
        if (!image.closest('a') && !this.userContent()) {
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

  /**
   * Scrolls the rendered heading `anchor` names into view: the one carrying it
   * as its id, else one without an id whose {@link headingSlug} matches.
   */
  scrollToHeading(anchor: string): void {
    const headings = this.headings();
    (
      headings.find((heading) => heading.id === anchor) ??
      headings.find(
        (heading) =>
          !heading.id && headingSlug(heading.textContent ?? '') === anchor
      )
    )?.scrollIntoView({ block: 'start' });
  }

  private headings(): HTMLElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        'h1, h2, h3, h4, h5, h6'
      )
    );
  }

  /**
   * Moves each heading's `{#id}` from its text onto the element. Here rather
   * than in the parse because the renderer's sanitizer drops `id` attributes.
   */
  private applyHeadingIds(): void {
    for (const heading of this.headings()) {
      let last = heading.lastChild;
      while (last && last.nodeType !== TEXT_NODE) {
        last = last.lastChild;
      }
      const text = last?.nodeValue;
      const match = text ? HEADING_ID.exec(text) : null;
      if (last && text && match) {
        last.nodeValue = text.slice(0, match.index);
        heading.id = match[1];
      }
    }
  }

  /**
   * Sizes each picture whose size the assets name, and floats it if portrait,
   * before its file arrives. Run in the same task the renderer wrote the
   * content in, so the first layout already has the final boxes.
   */
  private applyImageSizes(): void {
    const sizes = this.imageSizes();
    if (sizes.size === 0) {
      return;
    }
    for (const image of Array.from(
      this.host.nativeElement.querySelectorAll('img')
    )) {
      const size = sizes.get(image.getAttribute('src') ?? '');
      if (!size || size.width <= 0 || size.height <= 0) {
        continue;
      }
      image.style.setProperty('--lg-image-width', String(size.width));
      image.style.setProperty('--lg-image-height', String(size.height));
      image.classList.add('lg-sized');
      image.classList.toggle(
        'lg-portrait',
        isPortrait(size.width, size.height)
      );
    }
  }

  /** The renderer has written its content; anything reading it can run now. */
  protected onRendered(): void {
    if (!this.userContent()) {
      this.applyHeadingIds();
      this.applyImageSizes();
    }
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
      const anchor = decodeFragment(href.slice(1));
      if (anchor) {
        this.scrollToHeading(anchor);
      }
      return;
    }
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
    if (scheme === undefined || scheme === 'http' || scheme === 'https') {
      event.preventDefault();
      try {
        window.open(href, '_blank', 'noopener');
      } catch {
        // `https:` with nothing after it, say: the browser throws rather than
        // opening nothing, and a dead link is no reason for an error report.
        // Authored content reaches here unchecked; a member's is refused at
        // render time already.
      }
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
 * A fragment as the heading anchor it names. The renderer percent-encodes a
 * destination, so a slug carrying a non-ASCII letter arrives encoded and would
 * match nothing.
 */
function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    // A stray `%` is not an escape; the anchor is what was written.
    return fragment;
  }
}

/** Schemes the user agent handles without unloading the app. */
const NATIVE_SCHEMES: ReadonlySet<string> = new Set(['mailto', 'tel', 'sms']);
