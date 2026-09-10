import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { AVAILABLE_LANGUAGES, LanguageId } from '@logigator/core';
import {
  languageFromPath,
  pathInLanguage,
  pathWithoutLanguage
} from '../translation/language-url';
import { TranslationService } from '../translation/translation.service';
import { TranslationKey } from '../translation/translation-key.model';
import { SiteLinks } from '../layout/site-links';
import { SITE_ORIGIN } from './site-origin';
import {
  absoluteAssetUrl,
  BreadcrumbListNode,
  JsonLdContext,
  JsonLdNode,
  jsonLdIds,
  serializeJsonLd,
  siteNodes
} from './structured-data';

/**
 * Open Graph names a locale in its `language_TERRITORY` form, so the bare
 * language ids the rest of the origin speaks need a table of their own.
 */
const OG_LOCALES: Record<LanguageId, string> = {
  en: 'en_US',
  de: 'de_DE',
  fr: 'fr_FR',
  es: 'es_ES'
};

/** What a route tells {@link SeoService} about the page it renders. */
export interface PageMeta {
  /** Key of the page's own title; the site name is prepended. */
  titleKey: TranslationKey;
  /** Key of the page's description; the site's own is the fallback. */
  descriptionKey?: TranslationKey;
  /**
   * The page's own JSON-LD nodes, beside the site-level ones every page emits.
   * A factory rather than a value: the nodes name absolute URLs and read
   * translated strings, neither of which a route definition can know. It runs
   * after the route's guards, so a page whose content a guard resolved can
   * describe what it actually rendered.
   */
  jsonLd?: (context: JsonLdContext) => JsonLdNode[];
  /**
   * Whether the page is a step in a trail. On by default, since every page but
   * the home page is one level under it. Off for a page that must not name
   * itself: a 404, and anything whose URL carries a one-shot token.
   */
  breadcrumb?: false;
  /**
   * The steps between the home page and this one, for a page deeper than one
   * level. Unprefixed paths: the trail is emitted in the language the URL
   * names, like everything else in the head.
   */
  ancestors?: readonly { titleKey: TranslationKey; path: string }[];
  /**
   * Unprefixed path of the page's raw-markdown twin, where it has one. It is
   * announced in the head rather than left to be guessed, which is what makes
   * a reader that prefers the source able to find it.
   */
  markdownPath?: string;
}

/**
 * The per-page head: title, description, canonical, the `hreflang` alternates,
 * the Open Graph locale, and the page's JSON-LD graph.
 *
 * Every page exists in four languages under a prefix of its own. Each one
 * canonicalizes to itself and names all four as alternates, the pairing that
 * marks the set as translations of one another rather than duplicates.
 * `x-default` names the unprefixed URL, which negotiates a language of its own
 * for a visitor no alternate matches. `og:url` follows the canonical, a scraper
 * reading it as the object's identity and re-fetching it.
 *
 * The links, and the graph's script tag, are rewritten in place rather than
 * appended: a client-side navigation reuses the same document, and appending
 * would leave every page the visitor passed through in the head.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly translation = inject(TranslationService);
  private readonly links = inject(SiteLinks);
  private readonly origin = inject(SITE_ORIGIN).replace(/\/+$/, '');

  /** Applies a page's head for the URL currently being rendered. */
  public apply(page: PageMeta, pathname: string): void {
    const siteName = this.translation.translate('site.name');
    const pageTitle = this.translation.translate(page.titleKey);
    const description = this.translation.translate(
      page.descriptionKey ?? 'site.description'
    );

    this.title.setTitle(`${siteName} - ${pageTitle}`);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });

    // The language the URL names, so the head is a function of the page it
    // describes rather than of whatever the translation service holds.
    const lang = languageFromPath(pathname) ?? this.translation.getActiveLang();
    const canonicalPath = pathWithoutLanguage(pathname);
    const canonicalUrl = `${this.origin}${pathInLanguage(lang, canonicalPath)}`;

    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    this.setLink('canonical', undefined, canonicalUrl);
    this.meta.updateTag({ property: 'og:locale', content: OG_LOCALES[lang] });
    this.setLocaleAlternates(lang);

    for (const { id } of AVAILABLE_LANGUAGES) {
      this.setLink(
        'alternate',
        id,
        `${this.origin}${pathInLanguage(id, canonicalPath)}`
      );
    }
    // `x-default` is the URL for a visitor no alternate matches; that is the
    // unprefixed one, which negotiates a language of its own.
    this.setLink('alternate', 'x-default', `${this.origin}${canonicalPath}`);
    this.setMarkdownAlternate(
      page.markdownPath
        ? `${this.origin}${pathInLanguage(lang, page.markdownPath)}`
        : null
    );

    this.setStructuredData(
      page,
      {
        origin: this.origin,
        lang,
        url: canonicalUrl,
        siteId: jsonLdIds(this.origin).site,
        absolute: (url) => absoluteAssetUrl(this.origin, url),
        translate: (key, ...params) =>
          this.translation.translate(key, ...params)
      },
      canonicalPath,
      pageTitle
    );
  }

  /**
   * The page's `@graph`: the site and its publisher, the trail the page sits on,
   * and whatever the page itself declares.
   *
   * One script tag, replaced whole. A client-side navigation reuses the
   * document, so a second graph appended beside the first would describe two
   * pages at once and leave a consumer to guess which one it is reading.
   */
  private setStructuredData(
    page: PageMeta,
    context: JsonLdContext,
    canonicalPath: string,
    pageTitle: string
  ): void {
    const graph: JsonLdNode[] = siteNodes(context, this.links.repository);
    const trail = this.breadcrumb(page, context, canonicalPath, pageTitle);
    if (trail) {
      graph.push(trail);
    }
    graph.push(...(page.jsonLd?.(context) ?? []));

    this.setScript('web-json-ld', serializeJsonLd(graph));
  }

  /**
   * Home, whatever the page declares between, and the page itself — or nothing
   * for the home page, a trail of one item saying only that the page is where
   * it is.
   */
  private breadcrumb(
    page: PageMeta,
    context: JsonLdContext,
    canonicalPath: string,
    pageTitle: string
  ): BreadcrumbListNode | null {
    if (page.breadcrumb === false || canonicalPath === '/') {
      return null;
    }
    const steps = [
      {
        name: context.translate('site.name'),
        item: `${context.origin}/${context.lang}`
      },
      ...(page.ancestors ?? []).map((ancestor) => ({
        name: context.translate(ancestor.titleKey),
        item: `${context.origin}${pathInLanguage(context.lang, ancestor.path)}`
      })),
      { name: pageTitle, item: context.url }
    ];
    return {
      '@type': 'BreadcrumbList',
      itemListElement: steps.map((step, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: step.name,
        item: step.item
      }))
    };
  }

  /**
   * The raw-markdown twin of the page, or none. Removed rather than left
   * pointing at the last page that had one: a client-side navigation reuses
   * the document.
   */
  private setMarkdownAlternate(href: string | null): void {
    const selector = 'link[rel="alternate"][type="text/markdown"]';
    const existing =
      this.document.head.querySelector<HTMLLinkElement>(selector);
    if (href === null) {
      existing?.remove();
      return;
    }
    const link = existing ?? this.document.createElement('link');
    link.rel = 'alternate';
    link.type = 'text/markdown';
    link.href = href;
    if (!existing) {
      this.document.head.appendChild(link);
    }
  }

  /**
   * A `<script>` in the head, addressed by id so a navigation replaces the one
   * it wrote. `textContent`, not `innerHTML`: script content is raw text, and
   * the JSON is already escaped so that it cannot close the tag.
   */
  private setScript(id: string, json: string): void {
    let script = this.document.head.querySelector<HTMLScriptElement>(
      `script#${id}`
    );
    if (!script) {
      script = this.document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }
    script.textContent = json;
  }

  /**
   * The other locales the page is available in. Removed and re-added rather
   * than rewritten in place: which of the four they are moves with the active
   * language, so there is no stable tag per position to update.
   */
  private setLocaleAlternates(active: LanguageId): void {
    for (const tag of this.document.head.querySelectorAll(
      'meta[property="og:locale:alternate"]'
    )) {
      tag.remove();
    }
    for (const { id } of AVAILABLE_LANGUAGES) {
      if (id !== active) {
        this.meta.addTag({
          property: 'og:locale:alternate',
          content: OG_LOCALES[id]
        });
      }
    }
  }

  private setLink(rel: string, hreflang: string | undefined, href: string) {
    const selector = hreflang
      ? `link[rel="${rel}"][hreflang="${hreflang}"]`
      : `link[rel="${rel}"]`;
    let link = this.document.head.querySelector<HTMLLinkElement>(selector);
    if (!link) {
      link = this.document.createElement('link');
      link.rel = rel;
      if (hreflang) {
        link.hreflang = hreflang;
      }
      this.document.head.appendChild(link);
    }
    link.href = href;
  }
}
