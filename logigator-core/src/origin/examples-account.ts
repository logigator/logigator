/**
 * The account the site's examples belong to. The API seeds its documents from
 * `logigator-api/examples/` and keeps them out of the community browse
 * listings; the site reads its listing for the examples page and the home
 * page's teasers, and walks it for the sitemap the browse listings no longer
 * cover. One id for all of them, since a deployment that disagreed with itself
 * would show the examples twice or not at all.
 *
 * The legacy backend's seed account, kept so its share links resolve after
 * the cutover.
 */
export const EXAMPLES_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';

/**
 * The example the home page's hero board is a recording of, "Logigator
 * Marquee": its id in `logigator-api/examples/examples.json`, fixed there like
 * every seeded id. The site links the board to that example's row, which
 * carries the document id as its anchor.
 */
export const HERO_EXAMPLE_ID = '039c9918-e609-4512-b2f1-c9ad8116c202';
