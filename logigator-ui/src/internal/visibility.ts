/**
 * What a document's visibility can be, and what each state allows.
 *
 * Beside `share.ts` and for its reason: the editor's share dialog and the
 * site's are two implementations of one control, and the two must not come to
 * disagree about which states exist, which of them has a working link, or when
 * that link may be rotated — a disagreement that shows up as a URL handed to
 * somebody that resolves nothing, which is the failure nobody reports.
 *
 * The rules live here; the wording does not. Each app names the three states in
 * its own translation table, so this module is free of user-facing strings as
 * well as of Angular.
 */

/**
 * The three states, from the least to the most exposed. The order is part of
 * the module: both pickers draw them in it, and a state inserted in the middle
 * is one every dialog gets without being edited.
 */
export type LgDocumentVisibility = 'private' | 'unlisted' | 'public';

export const LG_DOCUMENT_VISIBILITIES: readonly LgDocumentVisibility[] = [
  'private',
  'unlisted',
  'public'
];

/**
 * Whether the document's link resolves for anybody who is not its owner.
 *
 * A private document's is not shown at all: the row that would hold a URL says
 * why there is none, rather than offering one that answers `404`. The link
 * itself survives the state — a document taken private keeps the URL it had,
 * and picking a state that resolves again hands out that same URL — so what
 * this answers is whether there is anything to hand out, not whether the
 * document has a link. An unlisted document's works and is not listed, which is
 * the state a link is handed out in.
 */
export function hasLiveLink(visibility: LgDocumentVisibility): boolean {
  return visibility !== 'private';
}

/**
 * Whether the current link may be rotated.
 *
 * Only while unlisted. A public document's page *is* its link
 * (`/community/{kind}/{link}`), so minting a new one would move a page that is
 * out in the world — the count on it, whatever it ranks for and whoever has
 * bookmarked it — and no control in a dialog is allowed to do that. It is what
 * an unlisted link is for: rotating it takes down every URL somebody was
 * handed, which is the revocation the token exists for.
 *
 * A private document is not one of them, though it has a link of its own: that
 * link is not shown, so a rotation there would be a button whose effect nobody
 * can see. It is one pick away — the state that shows the URL is the state that
 * replaces it — which is what the row saying there is no link to hand out
 * points the reader at.
 */
export function canRotateLink(visibility: LgDocumentVisibility): boolean {
  return visibility === 'unlisted';
}
