/**
 * Handing a document's link to somebody: the sheet where the browser has one,
 * the clipboard where it does not, and the two URLs both apps build from.
 *
 * Its own file, away from every component, because the editor and the site
 * hand out the same link — the artifact is one thing, so the rule that builds
 * it is one function, the way {@link pictureFor} is. `logigator-web`'s SSR
 * host reaches it through `crawler-image.ts` for the card URL `robots.txt`
 * derives its `Allow:` line from, so nothing here may reach Angular.
 */

/** What a share attempt did. `dismissed` is the user closing the sheet. */
export type LgShareOutcome = 'shared' | 'copied' | 'dismissed' | 'failed';

/**
 * A document's kind, in the two vocabularies that name it. The **API** names
 * its tables in the singular — `/api/share/project/{link}` — because that is
 * what one of its rows is; the **routes** spell the same thing in the plural,
 * because a document's page lives in a section: `/community/projects/{link}`.
 * Neither spelling is derived from the other here: two types rather than one
 * union of four strings, so a call site cannot hand one to the other.
 */
export type LgDocumentKind = 'project' | 'component';
export type LgCommunityKind = 'projects' | 'components';

export interface LgShareTarget {
  readonly title: string;
  readonly text?: string;
  readonly url: string;
}

/**
 * Whether this browser has a share sheet. The guard is inside the function,
 * the way `afterPaint` guards `requestAnimationFrame`, so a server render and
 * a template that reads it are both safe — and a browser without one draws the
 * clipboard wording, which is what it would have got anyway.
 */
export function canShare(): boolean {
  return (
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  );
}

/**
 * The sheet where there is one, the clipboard where there is not.
 *
 * A visitor closing the sheet rejects with an `AbortError`, which is not a
 * failure and must not be reported as one: the caller gets `dismissed` and
 * says nothing. A sheet that exists but refuses — an insecure origin, a
 * permission that was declined — still has the clipboard behind it.
 */
export async function shareOrCopy(
  target: LgShareTarget
): Promise<LgShareOutcome> {
  if (!canShare()) {
    return (await copyText(target.url)) ? 'copied' : 'failed';
  }

  try {
    await navigator.share({
      title: target.title,
      text: target.text,
      url: target.url
    });
    return 'shared';
  } catch (error) {
    if (isAbort(error)) return 'dismissed';
    return (await copyText(target.url)) ? 'copied' : 'failed';
  }
}

/**
 * Writes to the clipboard, answering whether it worked. A refusal is normal —
 * an insecure origin, a permission the visitor declined — so it is a boolean
 * rather than a throw, and every caller has the text on screen to select.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The path a document's page lives at, in all three of its states: a link
 * somebody was handed lands here whether the document is listed or not, and the
 * reader never leaves the section the listing is in. **Unprefixed** — each app
 * adds its own language segment, the site through `pathInLanguage` and the
 * editor through its own three lines, so that one of them cannot come to carry
 * a rule the other does not.
 *
 * The kind is the route's spelling (`LgCommunityKind`), which is what the
 * site's `SiteLinks.communityDocument` takes: one string, built once, so the
 * page the editor hands out and the page the site links to cannot drift apart.
 */
export function documentPath(kind: LgCommunityKind, link: string): string {
  return `/community/${kind}/${link}`;
}

/**
 * The API's composed 1200×630 card: what every consumer that cannot negotiate
 * a `<picture>` gets, a share surface reading `og:image` and a forum post
 * rendering an embed alike. One route per kind, because the link is a token in
 * two tables rather than a key the server can look up on its own.
 *
 * A path rather than a URL, because a snippet is pasted onto somebody else's
 * site — where a relative `/api/…` would resolve against *their* host. The
 * caller supplies the origin.
 */
export function shareCardUrl(kind: LgDocumentKind, link: string): string {
  return `/api/share/${kind}/${link}/card.png`;
}

/**
 * The same route as an access rule spells it: both of the segments the route
 * takes a variable in become `*`, which is what `robots.txt` matches a path by.
 * The wildcard is legitimate here rather than loose — what it stands in for is
 * a kind and a token, the only two things that can be there, so every URL the
 * line matches is a card and nothing else. Both tables and every token are why
 * it is one line rather than one per table.
 *
 * Derived from the builder above rather than written out, so that moving the
 * route cannot leave `robots.txt` naming a URL nothing serves: a mismatch
 * fails nothing, and nobody sees it until a pasted link unfurls blank. The cast
 * is the one place allowed to say a `*` is not a kind — this is an access rule,
 * not an address anything is ever fetched from.
 */
export const SHARE_CARD_PATH_PATTERN = shareCardUrl('*' as LgDocumentKind, '*');

/** Whether an error is a visitor closing the sheet rather than a failure. */
function isAbort(error: unknown): boolean {
  // Read by name rather than by `instanceof DOMException`: the constructor is
  // not present in every realm a library is loaded in, and an engine that
  // rejects with a plain object would slip past a class check.
  return (error as { name?: string } | null)?.name === 'AbortError';
}
