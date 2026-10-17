import type { CommunityProject, PublicProfile } from '@logigator/contract';

/**
 * The fewest top-level elements a document needs before its page is offered to
 * an index. Measured rather than picked: across the legacy site's saved
 * projects, a fifth had five elements or fewer or no wire at all — test boards,
 * a gate dropped and abandoned — while the median had nineteen.
 */
export const MIN_INDEXED_COMPONENTS = 6;

/**
 * Whether a published document's page is worth a search engine's index, by the
 * rule the head's `noindex` and the sitemap share — two copies would drift, and
 * a sitemap naming a page that tells the crawler not to index it is a
 * contradiction Search Console reports on every one of them.
 *
 * A search engine rates a site partly on everything it has indexed, and the
 * community outnumbers the site's own pages a hundred to one, so what is
 * offered is what earns a place: a real circuit, and one somebody wrote about
 * or another member starred. A page failing it is still public, listed and
 * linkable; it only stays out of an index.
 *
 * Visibility is not part of it: the sitemap only ever sees public rows, and
 * the page asks that first.
 */
export function documentIsIndexable(
  document: Pick<
    CommunityProject,
    'componentCount' | 'wireCount' | 'description' | 'stars'
  >
): boolean {
  return (
    document.componentCount >= MIN_INDEXED_COMPONENTS &&
    document.wireCount > 0 &&
    (document.description.trim() !== '' || document.stars > 0)
  );
}

/**
 * Whether a member's profile is worth an index: only once they have written a
 * bio. Without one the page is a username over tiles whose documents are
 * indexed on their own, which nobody searches for.
 *
 * No profile is in the sitemap even where this holds — the listing rows the
 * sitemap is walked from carry no bio, and a read per member to find out is a
 * request per author on every walk. A profile that qualifies is reached through
 * the author link on every one of its documents.
 */
export function profileIsIndexable(
  profile: Pick<PublicProfile, 'bio'>
): boolean {
  return profile.bio.trim() !== '';
}
