import {
  communityComponentPageSchema,
  communityProjectPageSchema,
  type CommunityComponent,
  type CommunityProject
} from '@logigator/contract';
import type { CommunityKind } from './app/api/services/community-api.service';
import { apiOrigin } from './api-origin';
import type { SitemapPage } from './sitemap';

/** The largest page the listing endpoints accept, so the walk is as short as
 * the API allows. */
const PAGE_SIZE = 100;

/**
 * How many pages of one listing are read. A guard against a `total` that
 * disagrees with what the endpoint returns rather than a product limit: at this
 * size it is 5 000 documents per table, well past the point at which the
 * sitemap has to become a sitemap index anyway.
 */
const MAX_PAGES = 50;

/**
 * How many of those requests are in flight at once. Bounded rather than all of
 * them: these are deep-`OFFSET` queries with a correlated star count, and fifty
 * at once would take the API's connection pool away from people reading pages.
 */
const CONCURRENCY = 4;

/**
 * How long a walk is reused for, matching the `Cache-Control` the route
 * answers with — past which a crawler is entitled to a fresh view anyway.
 */
const CACHE_MS = 300_000;

/**
 * How long one listing request may take before the walk gives up on it.
 *
 * `fetch` has no total timeout of its own and waits five minutes for headers,
 * and every caller shares the one walk — so an API that accepts the connection
 * and then stalls would hold every `/sitemap.xml` request open for that long
 * rather than failing any of them. A listing is one indexed query; ten seconds
 * is already far past a slow one.
 */
const REQUEST_TIMEOUT_MS = 10_000;

/** A row of either listing; the two are symmetric in everything read here. */
type CommunityRow = CommunityProject | CommunityComponent;

const LISTINGS = {
  projects: communityProjectPageSchema,
  components: communityComponentPageSchema
} satisfies Record<CommunityKind, unknown>;

let cached: { pages: SitemapPage[]; expiresAt: number } | null = null;
let inFlight: Promise<SitemapPage[]> | null = null;

/**
 * Everything the community has published, as sitemap entries: one per document
 * and one per member who published something.
 *
 * Held for as long as the response it goes into may be, and **deduplicated
 * while in flight**: the walk is up to a hundred requests, and two crawlers
 * arriving together would otherwise each start their own. A walk that fails
 * caches nothing — by decision the sitemap fails whole rather than naming
 * fewer documents than there are.
 */
export function communityPages(): Promise<SitemapPage[]> {
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.pages);
  }
  inFlight ??= readCommunityPages()
    .then((pages) => {
      cached = { pages, expiresAt: Date.now() + CACHE_MS };
      return pages;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Read through the same public listings the browse pages use — this phase adds
 * no API surface — rather than through an endpoint written for it, which would
 * be a second definition of what `public` means.
 *
 * A member's profile is derived from the authors that came back rather than
 * listed separately: the authors of the documents above are exactly the set of
 * profiles with anything on them.
 */
async function readCommunityPages(): Promise<SitemapPage[]> {
  const origin = apiOrigin();
  const [projects, components] = await Promise.all([
    listAll(origin, 'projects'),
    listAll(origin, 'components')
  ]);

  const authors = new Map<string, string>();
  for (const { author, lastEditedAt } of [...projects, ...components]) {
    const seen = authors.get(author.id);
    if (!seen || seen < lastEditedAt) {
      authors.set(author.id, lastEditedAt);
    }
  }

  return [
    ...toPages(projects, 'projects'),
    ...toPages(components, 'components'),
    ...[...authors].map(([id, lastModified]) => ({
      path: `/community/users/${id}`,
      lastModified,
      priority: 0.3
    }))
  ];
}

/**
 * One listing, whole. The first response carries `total`, so the rest of the
 * pages are known after it and are read concurrently — which also shortens the
 * window in which a save can shift the offsets under the walk.
 *
 * Ordered by `latest` rather than by the default ranking for the same reason:
 * trending re-ranks between two requests, while edit time only moves a row that
 * was written.
 */
async function listAll(
  origin: string,
  kind: CommunityKind
): Promise<CommunityRow[]> {
  const first = await readPage(origin, kind, 0);
  const pages = Math.min(Math.ceil(first.total / PAGE_SIZE), MAX_PAGES);

  const rest: CommunityRow[] = [];
  for (let from = 1; from < pages; from += CONCURRENCY) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, pages - from) }, (_, index) =>
        readPage(origin, kind, from + index)
      )
    );
    for (const page of batch) {
      rest.push(...page.entries);
    }
  }
  return [...first.entries, ...rest];
}

/**
 * One page of one listing, validated the way every other read of this API is —
 * a page this cannot parse is an error rather than a sitemap with holes in it.
 */
async function readPage(
  origin: string,
  kind: CommunityKind,
  page: number
): Promise<{ entries: CommunityRow[]; total: number }> {
  const url = `${origin}/api/community/${kind}?size=${PAGE_SIZE}&page=${page}&orderBy=latest`;
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw new Error(`GET ${url} answered ${response.status}`);
  }
  return LISTINGS[kind].parse(await response.json());
}

/** Documents as entries, each stamped with when it was last written. */
function toPages(
  entries: readonly CommunityRow[],
  kind: CommunityKind
): SitemapPage[] {
  return entries.map((entry) => ({
    path: `/community/${kind}/${entry.link}`,
    lastModified: entry.lastEditedAt,
    priority: 0.5
  }));
}
