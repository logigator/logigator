/**
 * The origin-wide `consent` cookie, as data: which optional kinds of storage
 * the visitor allowed. The site and the editor both ask the question and both
 * honour the answer, so one decision covers the whole origin and neither app
 * asks again for what the other already settled.
 *
 * The value is `<revision>` followed by one `.<category>` per granted category
 * — `1.analytics`, or `1` for a visitor who allowed nothing optional. Every
 * character is a legal cookie octet, so it is written and read unencoded.
 */

export const CONSENT_COOKIE = 'consent';

/**
 * What the current question asks. A decision recorded under any other revision
 * reads as no decision, so bumping it asks every visitor again — which is what
 * adding a category, or widening what an existing one covers, requires.
 */
export const CONSENT_REVISION = 1;

/**
 * The categories a visitor can allow or refuse. Storage the origin needs to
 * work at all is not a category: it asks nobody.
 */
export const CONSENT_CATEGORIES = ['analytics'] as const;

export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

const SEPARATOR = '.';

/**
 * The granted categories, or `null` while the visitor has not decided — an
 * absent cookie, one from another revision, or one that does not parse. The
 * cookie is client-writable, so anything unreadable asks the question again
 * rather than being taken as an answer.
 */
export function decodeConsent(
  raw: string | null | undefined
): readonly ConsentCategory[] | null {
  if (!raw) {
    return null;
  }
  const [revision, ...categories] = raw.split(SEPARATOR);
  if (revision !== String(CONSENT_REVISION)) {
    return null;
  }
  return CONSENT_CATEGORIES.filter((category) => categories.includes(category));
}

/**
 * The cookie value recording a decision under the current revision. Names that
 * are not categories are dropped, so the value only ever says what
 * {@link decodeConsent} can read back.
 */
export function encodeConsent(granted: readonly string[]): string {
  return [
    String(CONSENT_REVISION),
    ...CONSENT_CATEGORIES.filter((category) => granted.includes(category))
  ].join(SEPARATOR);
}
