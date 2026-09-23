import type { DocumentVisibility } from '@logigator/contract';

/** The three fields the rule reads, which every row the API answers carries. */
export interface ListingCandidate {
  visibility: DocumentVisibility;
  componentCount: number;
  wireCount: number;
}

/**
 * Whether a published document is being left out of every community listing
 * because there is nothing on it — the API's `listed()` predicate, restated so
 * its owner can be told why a document they published is nowhere to be found.
 *
 * Restated rather than reported: the counts are already on every row, and a
 * flag of its own would be one more field the contract carries to say what two
 * of its fields already do. A change to the API's rule is a change here too.
 */
export function isPublishedButEmpty(doc: ListingCandidate): boolean {
  return (
    doc.visibility === 'public' &&
    doc.componentCount === 0 &&
    doc.wireCount === 0
  );
}
