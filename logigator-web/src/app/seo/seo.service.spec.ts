import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { homeJsonLd } from '../pages/home/home-json-ld';
import { PageMeta, SeoService } from './seo.service';
import { SITE_ORIGIN } from './site-origin';
import { jsonLdIds, JsonLdNode } from './structured-data';

const ORIGIN = 'https://logigator.com';

function links(rel: string): { hreflang: string; href: string }[] {
  return [
    ...document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)
  ].map((link) => ({ hreflang: link.hreflang, href: link.href }));
}

/** The one graph in the head, as the objects a consumer would read. */
function graph(): (JsonLdNode & Record<string, unknown>)[] {
  const scripts = document.head.querySelectorAll(
    'script[type="application/ld+json"]'
  );
  expect(scripts).toHaveLength(1);
  const parsed = JSON.parse(scripts[0].textContent ?? '') as {
    '@graph': (JsonLdNode & Record<string, unknown>)[];
  };
  return parsed['@graph'];
}

function nodeTypes(): string[] {
  return graph().flatMap((node) =>
    Array.isArray(node['@type'])
      ? [...node['@type']]
      : [node['@type'] as string]
  );
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
      'link[rel="canonical"], link[rel="alternate"], meta[property^="og:locale"], script[type="application/ld+json"]'
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

  it('describes the page in a graph, not the one before it', () => {
    // A client-side navigation reuses the document, so a second script beside
    // the first would leave a consumer to guess which page it is reading.
    const seo = TestBed.inject(SeoService);
    seo.apply({ titleKey: 'pages.home.title', jsonLd: homeJsonLd }, '/en');
    seo.apply({ titleKey: 'pages.examples.title' }, '/de/examples');

    expect(nodeTypes()).not.toContain('SoftwareApplication');
    expect(graph().find((node) => node['@type'] === 'WebSite')).toMatchObject({
      '@id': jsonLdIds(ORIGIN).site,
      inLanguage: 'de'
    });
  });

  it('places an inner page under the home page, and the home page nowhere', () => {
    const seo = TestBed.inject(SeoService);

    seo.apply({ titleKey: 'pages.home.title' }, '/en');
    expect(nodeTypes()).not.toContain('BreadcrumbList');

    seo.apply({ titleKey: 'pages.examples.title' }, '/de/examples');
    const trail = graph().find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.['itemListElement']).toMatchObject([
      { position: 1, item: `${ORIGIN}/de` },
      { position: 2, item: `${ORIGIN}/de/examples` }
    ]);
  });

  it('walks a page deeper than one level through its ancestors', () => {
    TestBed.inject(SeoService).apply(
      {
        titleKey: 'pages.docs.pages.cloud',
        ancestors: [{ titleKey: 'pages.docs.title', path: '/docs' }]
      },
      '/de/docs/cloud'
    );

    const trail = graph().find((node) => node['@type'] === 'BreadcrumbList');
    expect(trail?.['itemListElement']).toMatchObject([
      { position: 1, item: `${ORIGIN}/de` },
      { position: 2, item: `${ORIGIN}/de/docs` },
      { position: 3, item: `${ORIGIN}/de/docs/cloud` }
    ]);
  });

  /**
   * The twin is announced rather than left to be guessed, and it is dropped
   * again on the next page: a client-side navigation reuses the document, so
   * one left behind would offer the last page's source for this one.
   */
  it.each([
    {
      type: 'text/markdown',
      page: {
        titleKey: 'pages.docs.pages.cloud',
        markdownPath: '/docs/cloud.md'
      } satisfies PageMeta,
      path: '/fr/docs/cloud',
      href: '/fr/docs/cloud.md'
    },
    {
      type: 'application/atom+xml',
      page: {
        titleKey: 'pages.changelog.title',
        feedPath: '/changelog.atom'
      } satisfies PageMeta,
      path: '/fr/changelog',
      href: '/fr/changelog.atom'
    }
  ])(
    'names the $type twin, in the page’s own language',
    ({ type, page, path, href }) => {
      const seo = TestBed.inject(SeoService);
      const alternate = () =>
        document.head.querySelector<HTMLLinkElement>(
          `link[rel="alternate"][type="${type}"]`
        )?.href ?? null;

      seo.apply(page, path);
      expect(alternate()).toBe(`${ORIGIN}${href}`);

      seo.apply({ titleKey: 'pages.examples.title' }, '/fr/examples');
      expect(alternate()).toBeNull();
    }
  );

  it('leaves out the trail a page must not name itself in', () => {
    // A crumb for `verify-email/<token>` would publish the token, and one for
    // a 404 would claim the URL is a page.
    TestBed.inject(SeoService).apply(
      { titleKey: 'pages.verifyEmail.title', breadcrumb: false },
      '/en/verify-email/a-one-shot-token'
    );

    expect(nodeTypes()).not.toContain('BreadcrumbList');
  });

  it('names the editor rather than the page advertising it', () => {
    // The application node is what a crawler reads to learn what the site is
    // for, so its URL has to be the thing it describes.
    TestBed.inject(SeoService).apply(
      { titleKey: 'pages.home.title', jsonLd: homeJsonLd },
      '/en'
    );

    expect(
      graph().find((node) => node['@id'] === jsonLdIds(ORIGIN).editor)
    ).toMatchObject({ url: `${ORIGIN}/editor` });
    expect(
      graph().find((node) => node['@type'] === 'VideoObject')
    ).toMatchObject({
      duration: 'PT3M34S',
      thumbnailUrl: expect.stringContaining(ORIGIN)
    });
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
