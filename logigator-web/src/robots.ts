import { SHARE_CARD_PATH_PATTERN } from './app/documents/crawler-image';

/**
 * `robots.txt`, origin-wide: Caddy serves this app at the root, so this one
 * file speaks for `/editor` and `/api` as well.
 *
 * It names no crawler. There is no `Google-Extended` block, no `noai`, nothing
 * about `GPTBot`, `ClaudeBot`, `PerplexityBot` or `CCBot` — the site's job is to
 * be found, by search engines and by the assistants people now ask instead, and
 * allowing by omission is the honest form of that. A roster of bot names reads
 * as policy and is stale the month a new one ships; its absence reads as what it
 * is. That is a decision, not an oversight: please do not "fix" it.
 *
 * The policy is defensible because of what is reachable. Every community query
 * carries `public = true`, so everything a crawler can walk was published by
 * whoever made it. The share link is the exception and is closed below.
 *
 * @param sitemap absolute URL of the sitemap, or `null` where the origin of the
 *   request could not be established. The file is still answered without the
 *   line rather than failing: a non-200 here is read as "crawl nothing".
 */
export function renderRobotsTxt(sitemap: string | null): string {
  return `${sitemap ? `Sitemap: ${sitemap}\n\n` : ''}User-agent: *

# The share link is a capability: it needs no session and ignores whether
# the document is public, so a page under it would put private circuits
# into an index — and a training set — by URL alone. The editor answers one
# such URL today; the second is the landing page this origin may still grow.
Disallow: /editor/share/
Disallow: /share/

# A card is the one thing under /api/ that is content, and a fetcher that
# honours the rule below would otherwise never render it. Ahead of the
# Disallow for a first-match reader; longest-match resolution does the rest.
Allow: ${SHARE_CARD_PATH_PATTERN}
Disallow: /api/

# One-shot mail tokens. The pages are noindex as well; this keeps them out
# of a crawl that never reads the markup. The language prefix is why each
# one starts with a wildcard.
Disallow: /*/verify-email/
Disallow: /*/reset-password

Allow: /
`;
}
