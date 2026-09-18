import { AVAILABLE_LANGUAGES } from '@logigator/core';
import { DOC_PAGE_IDS } from '@logigator/docs';
import {
  languageAlternates,
  pathInLanguage
} from './app/translation/language-url';
import { escapeXml } from './escape-xml';

/**
 * One page of the site, as the sitemap describes it. The path is unprefixed:
 * every entry exists once per language, and the set of them is what the
 * `hreflang` annotations pair up.
 */
export interface SitemapPage {
  /** Unprefixed path, without a trailing slash; `/` for the home page. */
  path: string;
  /** `<lastmod>`, an ISO instant, where the page has a knowable one. */
  lastModified?: string;
  /** `<priority>`, relative to the rest of this file. */
  priority: number;
}

/**
 * The pages that exist regardless of what the community has published, in the
 * order a reader would meet them.
 *
 * What is missing from it is checked rather than described: `route-seo.spec.ts`
 * holds every indexable page route to an entry here, so a page added to the
 * router and forgotten here is a failing test rather than a URL that quietly
 * never gets crawled.
 */
export const STATIC_PAGES: readonly SitemapPage[] = [
  { path: '/', priority: 1 },
  { path: '/examples', priority: 0.7 },
  { path: '/docs', priority: 0.7 },
  ...DOC_PAGE_IDS.map((page) => ({ path: `/docs/${page}`, priority: 0.6 })),
  { path: '/community/projects', priority: 0.6 },
  { path: '/community/components', priority: 0.6 },
  { path: '/changelog', priority: 0.4 },
  { path: '/login', priority: 0.3 },
  { path: '/register', priority: 0.3 },
  { path: '/imprint', priority: 0.2 },
  { path: '/privacy-policy', priority: 0.2 }
];

/**
 * The sitemap, one `<url>` per language per page.
 *
 * A page could be one entry naming the unprefixed URL instead, which is what
 * the legacy hand-maintained file did — but that URL is the negotiating `302`,
 * and a `<loc>` a crawler has to be redirected away from is not the address of
 * anything. Each language version is its own canonical (decision 52), so each
 * is its own entry, and all four plus `x-default` are annotated on every one of
 * them: that reciprocal set is what marks the five as translations rather than
 * duplicates.
 *
 * A sitemap holds 50 000 URLs. Four languages per page puts the ceiling at
 * 12 500 documents, past which this has to become a sitemap index — a change to
 * make when the number is in sight rather than a structure to carry until then.
 */
export function renderSitemap(
  origin: string,
  pages: readonly SitemapPage[]
): string {
  const entries = pages.flatMap((page) => {
    // Identical for all four of a page's entries — it names the whole set, not
    // the one being written — so it is built once per page rather than per URL.
    const alternates = languageAlternates(page.path)
      .map(
        ({ hreflang, path }) =>
          `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(origin + path)}"/>`
      )
      .join('\n');
    return AVAILABLE_LANGUAGES.map(({ id }) =>
      renderUrl(origin, page, pathInLanguage(id, page.path), alternates)
    );
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"' +
      ' xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...entries,
    '</urlset>',
    ''
  ].join('\n');
}

function renderUrl(
  origin: string,
  page: SitemapPage,
  path: string,
  alternates: string
): string {
  return [
    '  <url>',
    `    <loc>${escapeXml(origin + path)}</loc>`,
    ...(page.lastModified
      ? [`    <lastmod>${page.lastModified}</lastmod>`]
      : []),
    `    <priority>${page.priority.toFixed(1)}</priority>`,
    alternates,
    '  </url>'
  ].join('\n');
}
