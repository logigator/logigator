import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { SeoService } from './seo.service';
import { SITE_ORIGIN } from './site-origin';

const ORIGIN = 'https://logigator.com';

function links(rel: string): { hreflang: string; href: string }[] {
  return [
    ...document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)
  ].map((link) => ({ hreflang: link.hreflang, href: link.href }));
}

describe('SeoService', () => {
  beforeEach(() => {
    configureTestBed([{ provide: SITE_ORIGIN, useValue: ORIGIN }]);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    for (const link of document.head.querySelectorAll(
      'link[rel="canonical"], link[rel="alternate"]'
    )) {
      link.remove();
    }
  });

  it('canonicalizes to the language-prefix-free URL', () => {
    // The four translations must not read as duplicates of one another, so all
    // of them name one canonical, and it is the URL that negotiates a language.
    TestBed.inject(SeoService).apply(
      { titleKey: 'pages.home.title' },
      '/de/features'
    );

    expect(links('canonical')).toEqual([
      { hreflang: '', href: `${ORIGIN}/features` }
    ]);
  });

  it('names every language plus x-default as alternates', () => {
    TestBed.inject(SeoService).apply(
      { titleKey: 'pages.home.title' },
      '/en/features'
    );

    expect(links('alternate')).toEqual([
      { hreflang: 'en', href: `${ORIGIN}/en/features` },
      { hreflang: 'de', href: `${ORIGIN}/de/features` },
      { hreflang: 'fr', href: `${ORIGIN}/fr/features` },
      { hreflang: 'es', href: `${ORIGIN}/es/features` },
      { hreflang: 'x-default', href: `${ORIGIN}/features` }
    ]);
  });

  it('rewrites the links a second navigation replaces', () => {
    // A client-side navigation reuses the document, so appending would leave
    // the head naming every page the visitor passed through.
    const seo = TestBed.inject(SeoService);
    seo.apply({ titleKey: 'pages.home.title' }, '/en/features');
    seo.apply({ titleKey: 'pages.notFound.title' }, '/en/imprint');

    expect(links('canonical')).toEqual([
      { hreflang: '', href: `${ORIGIN}/imprint` }
    ]);
    expect(links('alternate')).toHaveLength(5);
  });
});
