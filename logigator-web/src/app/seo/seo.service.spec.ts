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

function metaContent(property: string): string[] {
  return [
    ...document.head.querySelectorAll<HTMLMetaElement>(
      `meta[property="${property}"]`
    )
  ].map((tag) => tag.content);
}

describe('SeoService', () => {
  beforeEach(() => {
    configureTestBed([{ provide: SITE_ORIGIN, useValue: ORIGIN }]);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    for (const tag of document.head.querySelectorAll(
      'link[rel="canonical"], link[rel="alternate"], meta[property^="og:locale"]'
    )) {
      tag.remove();
    }
  });

  it('canonicalizes a language version to itself', () => {
    // A canonical naming another language's URL asks to be dropped as a
    // duplicate of it, so three of the four translations would never index.
    TestBed.inject(SeoService).apply(
      { titleKey: 'pages.home.title' },
      '/de/features'
    );

    expect(links('canonical')).toEqual([
      { hreflang: '', href: `${ORIGIN}/de/features` }
    ]);
    expect(metaContent('og:url')).toEqual([`${ORIGIN}/de/features`]);
  });

  it('names every language plus x-default as alternates', () => {
    TestBed.inject(SeoService).apply(
      { titleKey: 'pages.home.title' },
      '/en/features'
    );

    // The unprefixed URL is x-default's: it negotiates a language, so it answers
    // a visitor no alternate matches.
    expect(links('alternate')).toEqual([
      { hreflang: 'en', href: `${ORIGIN}/en/features` },
      { hreflang: 'de', href: `${ORIGIN}/de/features` },
      { hreflang: 'fr', href: `${ORIGIN}/fr/features` },
      { hreflang: 'es', href: `${ORIGIN}/es/features` },
      { hreflang: 'x-default', href: `${ORIGIN}/features` }
    ]);
  });

  it('reports the page locale and the ones it translates to', () => {
    TestBed.inject(SeoService).apply(
      { titleKey: 'pages.home.title' },
      '/de/features'
    );

    expect(metaContent('og:locale')).toEqual(['de_DE']);
    expect(metaContent('og:locale:alternate').sort()).toEqual([
      'en_US',
      'es_ES',
      'fr_FR'
    ]);
  });

  it('rewrites the links a second navigation replaces', () => {
    // A client-side navigation reuses the document, so appending would leave
    // the head naming every page the visitor passed through.
    const seo = TestBed.inject(SeoService);
    seo.apply({ titleKey: 'pages.home.title' }, '/en/features');
    seo.apply({ titleKey: 'pages.notFound.title' }, '/de/imprint');

    expect(links('canonical')).toEqual([
      { hreflang: '', href: `${ORIGIN}/de/imprint` }
    ]);
    expect(links('alternate')).toHaveLength(5);
    expect(metaContent('og:locale')).toEqual(['de_DE']);
    expect(metaContent('og:locale:alternate')).toHaveLength(3);
  });
});
