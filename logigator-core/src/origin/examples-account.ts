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
