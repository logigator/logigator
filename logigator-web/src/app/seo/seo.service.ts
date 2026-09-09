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
import { SITE_ORIGIN } from './site-origin';

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
}

/**
 * The per-page head: title, description, canonical, the `hreflang` alternates
 * and the Open Graph locale.
 *
 * Every page exists in four languages under a prefix of its own. Each one
 * canonicalizes to itself and names all four as alternates, the pairing that
 * marks the set as translations of one another rather than duplicates.
 * `x-default` names the unprefixed URL, which negotiates a language of its own
 * for a visitor no alternate matches. `og:url` follows the canonical, a scraper
 * reading it as the object's identity and re-fetching it.
 *
 * The links are rewritten in place rather than appended, since a client-side
 * navigation reuses the same document and appending would leave every page it
 * passed through in the head.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly translation = inject(TranslationService);
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
