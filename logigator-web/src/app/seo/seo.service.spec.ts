import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { configureTestBed } from '../../testing/configure-test-bed';
import { clearSeoHead, jsonLdGraph } from '../../testing/json-ld';
import { TranslationService } from '../translation/translation.service';
import { homeJsonLd } from '../pages/home/home-json-ld';
import { PageMeta, SeoService } from './seo.service';
import { SITE_ORIGIN } from './site-origin';
import { jsonLdIds } from './structured-data';

const ORIGIN = 'https://logigator.com';

function links(rel: string): { hreflang: string; href: string }[] {
  return [
    ...document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`)
  ].map((link) => ({ hreflang: link.hreflang, href: link.href }));
}

function nodeTypes(): string[] {
  return jsonLdGraph().flatMap((node) =>
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
    clearSeoHead();
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
    expect(
      jsonLdGraph().find((node) => node['@type'] === 'WebSite')
    ).toMatchObject({
      '@id': jsonLdIds(ORIGIN).site,
      inLanguage: 'de'
    });
  });

  it('places an inner page under the home page, and the home page nowhere', () => {
    const seo = TestBed.inject(SeoService);

    seo.apply({ titleKey: 'pages.home.title' }, '/en');
    expect(nodeTypes()).not.toContain('BreadcrumbList');

    seo.apply({ titleKey: 'pages.examples.title' }, '/de/examples');
    const trail = jsonLdGraph().find(
      (node) => node['@type'] === 'BreadcrumbList'
    );
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

    const trail = jsonLdGraph().find(
      (node) => node['@type'] === 'BreadcrumbList'
    );
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
      jsonLdGraph().find((node) => node['@id'] === jsonLdIds(ORIGIN).editor)
    ).toMatchObject({ url: `${ORIGIN}/editor` });
    expect(
      jsonLdGraph().find((node) => node['@type'] === 'VideoObject')
    ).toMatchObject({
      duration: 'PT3M34S',
      thumbnailUrl: expect.stringContaining(ORIGIN)
    });
  });

  /**
   * A page describing stored content names it — a circuit, a member — and the
   * key stays the fallback for the case where the read found nothing, so the
   * head never announces a document that is not on the page.
   */
  it('lets a page name what it rendered, and falls back to its key', async () => {
    // The table loads through a dynamic import, and this asserts on the words.
    await TestBed.inject(TranslationService).setActiveLang('en');
    const seo = TestBed.inject(SeoService);

    seo.apply(
      {
        titleKey: 'pages.community.browse.projectsTitle',
        title: () => 'Half adder',
        description: () => 'Two gates, one carry.'
      },
      '/en/community/projects/half-adder'
    );
    expect(document.title).toContain('Half adder');
    expect(metaContent('og:title')).toEqual(['Half adder']);
    expect(metaContent('og:description')).toEqual(['Two gates, one carry.']);

    // Nothing resolved: the key answers rather than an empty title.
    seo.apply(
      {
        titleKey: 'pages.community.browse.projectsTitle',
        title: () => null,
        description: () => '   '
      },
      '/en/community/projects/gone'
    );
    expect(document.title).toContain('Community Projects');
    expect(metaContent('og:description')).toEqual([
      'Build and simulate your own logic circuits with Logigator, a simple yet powerful web-based online tool.'
    ]);
  });

  it('walks a trail whose steps are stored text rather than keys', () => {
    // A stargazer list sits under a document, and the document's name is not a
    // translation key — which is what `ancestors` alone cannot express.
    TestBed.inject(SeoService).apply(
      {
        titleKey: 'pages.community.stargazers.title',
        ancestors: [{ titleKey: 'pages.docs.title', path: '/docs' }],
        trail: () => [
          { name: 'Community Projects', path: '/en/community/projects' },
          { name: 'Half adder', path: '/en/community/projects/abc' }
        ]
      },
      '/en/community/projects/abc/stargazers'
    );

    const trail = jsonLdGraph().find(
      (node) => node['@type'] === 'BreadcrumbList'
    );
    // The resolved steps win over the static ones; a page cannot carry both.
    expect(trail?.['itemListElement']).toMatchObject([
      { position: 1, item: `${ORIGIN}/en` },
      { position: 2, name: 'Community Projects' },
      { position: 3, name: 'Half adder' },
      { position: 4, item: `${ORIGIN}/en/community/projects/abc/stargazers` }
    ]);
  });

  describe('the picture a share surface unfurls', () => {
    function imageTags(): string[] {
      return [
        ...document.head.querySelectorAll<HTMLMetaElement>(
          'meta[property="og:image"], meta[name="twitter:image"]'
        )
      ].map((tag) => tag.content);
    }

    it('is the site card for a page with none of its own', () => {
      TestBed.inject(SeoService).apply(
        { titleKey: 'pages.home.title' },
        '/en/examples'
      );

      expect(imageTags()).toEqual([
        `${ORIGIN}/assets/social-card.png`,
        `${ORIGIN}/assets/social-card.png`
      ]);
    });

    it("is the page's own where it declares one, made absolute", () => {
      TestBed.inject(SeoService).apply(
        {
          titleKey: 'pages.community.browse.projectsTitle',
          image: () => '/api/share/abc/card.png'
        },
        '/en/community/projects/abc'
      );

      expect(imageTags()).toEqual([
        `${ORIGIN}/api/share/abc/card.png`,
        `${ORIGIN}/api/share/abc/card.png`
      ]);
    });

    it('falls back where the page resolved nothing to name', () => {
      // The same degradation the title makes: a link naming nothing published
      // unfurls as the site rather than as a card for a missing document.
      const seo = TestBed.inject(SeoService);
      seo.apply(
        {
          titleKey: 'pages.community.browse.projectsTitle',
          image: () => '/api/share/abc/card.png'
        },
        '/en/community/projects/abc'
      );
      seo.apply(
        {
          titleKey: 'pages.community.browse.projectsTitle',
          image: () => null
        },
        '/en/community/projects/gone'
      );

      expect(imageTags()).toEqual([
        `${ORIGIN}/assets/social-card.png`,
        `${ORIGIN}/assets/social-card.png`
      ]);
    });
  });

  it('keeps a one-shot token page out of an index, and only that page', () => {
    const seo = TestBed.inject(SeoService);
    seo.apply(
      { titleKey: 'pages.verifyEmail.title', noindex: true },
      '/en/verify-email/abc'
    );

    expect(
      document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
        ?.content
    ).toBe('noindex, follow');

    // Removed on the next navigation: the document is reused, so a tag left
    // behind would drop the page the visitor moved to out of the index.
    seo.apply({ titleKey: 'pages.home.title' }, '/en');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
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
