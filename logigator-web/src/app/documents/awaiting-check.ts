import type { DocumentHidden, DocumentVisibility } from '@logigator/contract';

/** The fields the rule reads; a row created on the page has no check yet to report. */
export interface CheckCandidate {
  visibility: DocumentVisibility;
  awaitingCheck?: boolean;
  hidden?: DocumentHidden;
}

/**
 * Whether a published document is being left out of every community listing
 * until its name and description have been checked — so its owner can be told
 * why a document they just published, or just renamed, is nowhere to be
 * found yet.
 *
 * The API decides `awaitingCheck` by the same rule its listings use, and says
 * it whatever the visibility, as the counts the empty rule reads are; asking
 * for `public` here is what keeps a row whose visibility the shelf changed in
 * place answering right. A hidden document is in no listing either way, and
 * its own notice says so.
 */
export function isPublishedAwaitingCheck(doc: CheckCandidate): boolean {
  return doc.visibility === 'public' && !!doc.awaitingCheck && !doc.hidden;
}
