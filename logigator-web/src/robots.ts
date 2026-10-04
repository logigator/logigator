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
 * The policy is defensible because of what is reachable. Every listing query
 * carries `visibility = 'public'`, so everything a crawler can walk from a
 * listing was published by whoever made it. A URL somebody was handed is the
 * other way in, and it is closed below — while the page such a URL lands on is
 * left crawlable, so that the `noindex` it answers with is there to be read.
 *
 * @param sitemap absolute URL of the sitemap, or `null` where the origin of the
 *   request could not be established. The file is still answered without the
 *   line rather than failing: a non-200 here is read as "crawl nothing".
 */
export function renderRobotsTxt(sitemap: string | null): string {
  return `${sitemap ? `Sitemap: ${sitemap}\n\n` : ''}User-agent: *

# A link needs no session and resolves whatever the document's state, so the
# editor route that opens one is closed here, along with the unprefixed
# /share/ path the site's own landing page used to answer. The page a link
# arrives at now, /<lang>/community/<kind>/<link>, is deliberately NOT closed:
# it answers "robots: noindex, follow" whenever the document is not public,
# which is the only lever that works on a URL reached by links. A crawler is
# never told to skip what it is forbidden to fetch, and "indexed, though
# blocked" is the outcome this file exists to prevent. Which is also why
# /community/ must never be disallowed: that page lives in it, and a rule over
# the section would put the tag out of reach with it.
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
