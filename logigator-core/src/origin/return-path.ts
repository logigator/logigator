/**
 * Where a visitor is sent back to once a sign-in finishes. The site puts one on
 * the link that starts the flow, the API stores it with the flow and redirects
 * to it at the end — so both sides have to agree on what counts as one, and the
 * rule lives here rather than twice.
 *
 * Only a path on this origin qualifies. A redirect target a caller chooses is
 * an open redirect, and the routes that read one are unauthenticated: a
 * phishing page reached through a real Logigator link is exactly what this
 * refuses.
 */

/** Query parameter carrying the destination, on the site and on `/api/auth/google`. */
export const RETURN_PATH_PARAM = 'returnUrl';

/** Whether a character would split a `Location` header or a cookie line. */
function isControlCharacter(character: string): boolean {
  const code = character.charCodeAt(0);
  return code < 0x20 || code === 0x7f;
}

/**
 * The value as a path this origin can be sent to, or `null` for anything else.
 *
 * A leading `/` is not enough on its own: `//evil.test` and `/\evil.test` are
 * both read as protocol-relative URLs by browsers. What survives is a
 * single-slash absolute path with nothing in it that could split a header.
 */
export function safeReturnPath(
  value: string | null | undefined
): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value[0] !== '/') return null;
  if (value[1] === '/' || value[1] === '\\') return null;
  if ([...value].some(isControlCharacter)) return null;
  return value;
}
