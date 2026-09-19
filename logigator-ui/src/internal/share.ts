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
 * The path a shared link lands on: the site's page for it. **Unprefixed** —
 * each app adds its own language segment, the site through `pathInLanguage`
 * and the editor through its own three lines, so that one of them cannot come
 * to carry a rule the other does not.
 */
export function shareLandingPath(link: string): string {
  return `/share/${link}`;
}

/**
 * The API's composed 1200×630 card: what every consumer that cannot negotiate
 * a `<picture>` gets, a share surface reading `og:image` and a forum post
 * rendering an embed alike. One route, the link being the capability.
 *
 * A path rather than a URL, because a snippet is pasted onto somebody else's
 * site — where a relative `/api/…` would resolve against *their* host. The
 * caller supplies the origin.
 */
export function shareCardUrl(link: string): string {
  return `/api/share/${link}/card.png`;
}

/** Whether an error is a visitor closing the sheet rather than a failure. */
function isAbort(error: unknown): boolean {
  // Read by name rather than by `instanceof DOMException`: the constructor is
  // not present in every realm a library is loaded in, and an engine that
  // rejects with a plain object would slip past a class check.
  return (error as { name?: string } | null)?.name === 'AbortError';
}
