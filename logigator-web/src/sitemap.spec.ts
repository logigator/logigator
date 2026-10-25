import { describe, expect, it } from 'vitest';
import { AVAILABLE_LANGUAGES } from '@logigator/core';
import {
  PAGES_PER_SITEMAP,
  renderSitemap,
  renderSitemapIndex,
  sitemapFiles,
  STATIC_PAGES,
  type SitemapPage
} from './sitemap';

const ORIGIN = 'https://logigator.com';

/** Every `<loc>` the document names, in order. */
function locations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
}

describe('renderSitemap', () => {
  it('names every language version as a location of its own', () => {
    const xml = renderSitemap(ORIGIN, [{ path: '/examples', priority: 0.7 }]);

    expect(locations(xml)).toEqual(
      AVAILABLE_LANGUAGES.map(({ id }) => `${ORIGIN}/${id}/examples`)
    );
  });

  it('never names the unprefixed URL of a localized page as a location', () => {
    const xml = renderSitemap(
      ORIGIN,
      STATIC_PAGES.filter((page) => page.localized !== false)
    );

    // It is the negotiating `302`, so it is nothing's canonical — and a `<loc>`
    // a crawler has to be redirected away from is not the address of anything.
    for (const loc of locations(xml)) {
      expect(loc).toMatch(/^https:\/\/logigator\.com\/[a-z]{2}(\/|$)/);
    }
  });

  it('annotates each entry with all four alternates and x-default', () => {
    const xml = renderSitemap(ORIGIN, [{ path: '/', priority: 1 }]);
    const entries = xml.split('<url>').slice(1);

    expect(entries).toHaveLength(AVAILABLE_LANGUAGES.length);
    for (const entry of entries) {
      for (const { id } of AVAILABLE_LANGUAGES) {
        expect(entry).toContain(
          `<xhtml:link rel="alternate" hreflang="${id}" href="${ORIGIN}/${id}"/>`
        );
      }
      expect(entry).toContain(
        `<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/"/>`
      );
    }
  });

  it('names a page with one address for every language once, as it is', () => {
    const xml = renderSitemap(ORIGIN, [
      { path: '/editor', priority: 0.8, localized: false }
    ]);

    expect(locations(xml)).toEqual([`${ORIGIN}/editor`]);
    expect(xml).not.toContain('<xhtml:link');
  });

  it('emits lastmod only where the page has one', () => {
    const xml = renderSitemap(ORIGIN, [
      {
        path: '/community/projects/abc',
        lastModified: '2026-09-01T10:00:00Z',
        priority: 0.5
      },
      { path: '/imprint', priority: 0.2 }
    ]);

    expect(xml.match(/<lastmod>/g)).toHaveLength(AVAILABLE_LANGUAGES.length);
    expect(xml).toContain('<lastmod>2026-09-01T10:00:00Z</lastmod>');
  });

  it('escapes a path, so a stored token cannot end an element', () => {
    const xml = renderSitemap(ORIGIN, [
      { path: '/community/projects/a&b"<c>', priority: 0.5 }
    ]);

    expect(xml).not.toContain('&b"<c>');
    expect(xml).toContain('a&amp;b&quot;&lt;c&gt;');
  });

  it('lists no page that needs a session or carries a one-shot token', () => {
    for (const page of STATIC_PAGES) {
      expect(page.path, page.path).not.toMatch(
        /^\/(my|reset-password|verify-email)/
      );
    }
  });
});

/** `count` community pages with distinct paths, newest first. */
function documents(count: number): SitemapPage[] {
  return Array.from({ length: count }, (_, index) => ({
    path: `/community/projects/${index}`,
    priority: 0.5
  }));
}

describe('sitemapFiles', () => {
  it('cuts a section into files a crawler accepts, losing no page', () => {
    const pages = documents(2 * PAGES_PER_SITEMAP + 1);
    const files = sitemapFiles('projects', pages);

    expect(files.map(({ name }) => name)).toEqual([
      'projects-1',
      'projects-2',
      'projects-3'
    ]);
    expect(files.flatMap((file) => file.pages)).toEqual(pages);
    for (const file of files) {
      // The protocol's limit is 50 000 URLs per file, one per language.
      expect(
        file.pages.length * AVAILABLE_LANGUAGES.length
      ).toBeLessThanOrEqual(50_000);
    }
  });

  it('writes no file for a section with nothing in it', () => {
    expect(sitemapFiles('components', [])).toEqual([]);
  });
});

describe('renderSitemapIndex', () => {
  it('names each file absolutely, stamped with its newest page', () => {
    const xml = renderSitemapIndex(ORIGIN, [
      { name: 'static', pages: STATIC_PAGES },
      {
        name: 'projects-1',
        pages: [
          { path: '/a', lastModified: '2026-09-01T10:00:00Z', priority: 0.5 },
          { path: '/b', lastModified: '2026-10-02T08:00:00Z', priority: 0.5 },
          { path: '/c', priority: 0.5 }
        ]
      }
    ]);
    const entries = xml.split('<sitemap>').slice(1);

    expect(locations(xml)).toEqual([
      `${ORIGIN}/sitemaps/static.xml`,
      `${ORIGIN}/sitemaps/projects-1.xml`
    ]);
    // Nothing static has a knowable edit time, so that file claims none.
    expect(entries[0]).not.toContain('<lastmod>');
    expect(entries[1]).toContain('<lastmod>2026-10-02T08:00:00Z</lastmod>');
  });
});
