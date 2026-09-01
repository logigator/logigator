import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { AVAILABLE_LANGUAGES } from '@logigator/core';
import {
  pathInLanguage,
  pathWithoutLanguage
} from '../translation/language-url';
import { TranslationService } from '../translation/translation.service';
import { TranslationKey } from '../translation/translation-key.model';
import { SITE_ORIGIN } from './site-origin';

/** What a route tells {@link SeoService} about the page it renders. */
export interface PageMeta {
  /** Key of the page's own title; the site name is prepended. */
  titleKey: TranslationKey;
  /** Key of the page's description; the site's own is the fallback. */
  descriptionKey?: TranslationKey;
}

/**
 * The per-page head: title, description, canonical and the `hreflang`
 * alternates.
 *
 * Every page exists in four languages under a prefix of its own, so each one
 * has to name the other three, and the canonical drops the prefix entirely — a
 * crawler that follows an alternate must not treat the four as duplicates of
 * one another, and must be told which URL to index.
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

    const canonicalPath = pathWithoutLanguage(pathname);
    this.meta.updateTag({
      property: 'og:url',
      content: `${this.origin}${canonicalPath}`
    });
    this.setLink('canonical', undefined, `${this.origin}${canonicalPath}`);
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
