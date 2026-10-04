import { describe, expect, it } from 'vitest';
import { AVAILABLE_LANGUAGES } from '@logigator/core';
import { renderSitemap, STATIC_PAGES } from './sitemap';

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

  it('never names the unprefixed URL as a location', () => {
    const xml = renderSitemap(ORIGIN, STATIC_PAGES);

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
