import { classifySocialUrl } from '@logigator/core';
import type { SocialLink } from '@logigator/contract';

/**
 * The stored URLs as a read answers them: each beside the platform its host
 * classifies as.
 *
 * **Classified here, on every read, and never stored.** Growing the table in
 * `@logigator/core` then reclassifies every profile that exists, which a
 * classification written into the column could not do without a migration —
 * and it is a host lookup, not a parse. `CircuitDocumentService.ingest` stores
 * its parse for the opposite reason: that one is expensive and the stored rows
 * are derived from it.
 *
 * One function rather than one per caller because the two reads that answer a
 * profile — the account's own and the public one — have to agree about what a
 * link is, and a link named differently on two pages of the same site is the
 * kind of disagreement nobody reports as a bug.
 */
export function toSocialLinks(urls: readonly string[]): SocialLink[] {
  return urls.map((url) => ({ url, platform: classifySocialUrl(url) }));
}
