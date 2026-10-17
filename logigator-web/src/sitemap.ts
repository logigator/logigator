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
 *
 * A route carrying a parameter is exempt from that check, and must stay out:
 * the community's own pages are read from the API below, and a document's page
 * is absent by decision rather than by omission — that walk reads the listings,
 * which carry only what is public, so a document its owner left unlisted or
 * private has no way into this file. A literal `:link` would be a URL that
 * resolves to nothing.
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
 * One file of a set rather than the whole site: {@link sitemapFiles} cuts the
 * pages into files that stay inside a crawler's limits, and
 * {@link renderSitemapIndex} names them.
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

/**
 * How many pages one file of the set holds: 40 000 URLs at four languages,
 * under the 50 000 a sitemap may name. Short of the limit rather than at it,
 * because the other limit is 50 MB uncompressed, and an entry carrying its five
 * alternates measured about 870 bytes — a full file is 35 MB, which leaves room
 * for a longer origin than the one it was measured on.
 */
export const PAGES_PER_SITEMAP = 10_000;

/** One file of the sitemap set, as the index names it. */
export interface SitemapFile {
  /** `static`, or a section and its 1-based part: `projects-2`. */
  name: string;
  pages: readonly SitemapPage[];
}

/**
 * A section of the site as files of at most {@link PAGES_PER_SITEMAP} pages.
 * `static` is never cut and keeps its bare name; any other section is
 * numbered from 1, so a second file appearing does not rename the first, and a
 * section with nothing to name is no file rather than an empty one.
 */
export function sitemapFiles(
  section: string,
  pages: readonly SitemapPage[]
): SitemapFile[] {
  if (section === 'static') {
    return [{ name: section, pages }];
  }
  const files: SitemapFile[] = [];
  for (let from = 0; from < pages.length; from += PAGES_PER_SITEMAP) {
    files.push({
      name: `${section}-${files.length + 1}`,
      pages: pages.slice(from, from + PAGES_PER_SITEMAP)
    });
  }
  return files;
}

/** Where a file of the set is answered, relative to the origin. */
export function sitemapFilePath(name: string): string {
  return `/sitemaps/${name}.xml`;
}

/**
 * The sitemap index `/sitemap.xml` answers, which is what `robots.txt` names.
 * The community alone outgrew one file's limits, and a file over them is
 * rejected whole rather than read partway. A set also lets Search Console
 * report each section's coverage on its own, the community's apart from the
 * pages the site wrote.
 *
 * Each file's `<lastmod>` is the newest of its pages', where any has one —
 * which is what tells a crawler that a file is worth fetching again.
 */
export function renderSitemapIndex(
  origin: string,
  files: readonly SitemapFile[]
): string {
  const entries = files.map((file) => {
    const lastModified = file.pages.reduce<string | undefined>(
      (newest, { lastModified }) =>
        lastModified && (!newest || lastModified > newest)
          ? lastModified
          : newest,
      undefined
    );
    return [
      '  <sitemap>',
      `    <loc>${escapeXml(origin + sitemapFilePath(file.name))}</loc>`,
      ...(lastModified ? [`    <lastmod>${lastModified}</lastmod>`] : []),
      '  </sitemap>'
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</sitemapindex>',
    ''
  ].join('\n');
}
