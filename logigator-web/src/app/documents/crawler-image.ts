import type {
  CircuitPreview,
  ImageFormat,
  ImageVariant
} from '@logigator/contract';

/**
 * The one URL to hand a consumer that can negotiate nothing: a crawler reading
 * JSON-LD, a share surface reading `og:image`. Everything the API serves comes
 * as a ladder of sizes and encodings, and `<picture>` is what picks a rung — so
 * anything outside a document needs this rule instead of that one.
 *
 * The widest rung, since whatever crops or scales it is not ours, in the format
 * every consumer reads rather than the one the browsers prefer.
 */
export function crawlerImageUrl(
  variants: readonly ImageVariant[] | null | undefined,
  format: ImageFormat
): string | null {
  if (!variants?.length) return null;

  const widest = Math.max(...variants.map((variant) => variant.width));
  const largest = variants.filter((variant) => variant.width === widest);
  const preferred = largest.find((variant) => variant.format === format);
  return (preferred ?? largest[0])?.url ?? null;
}

/**
 * A circuit's render for the same consumers. The **light** slot, in every
 * language and both schemes: a preview is line art on a transparent ground, so
 * the dark render's pale wires disappear wherever the consumer composites onto
 * white — which is most places. PNG, for the reason the stored fallback is PNG.
 */
export function crawlerPreviewUrl(
  preview: CircuitPreview | null
): string | null {
  return crawlerImageUrl(preview?.light, 'png');
}

/**
 * The picture a pasted link to a published document unfurls as: the API's
 * composed 1200×630 card, drawn from the row and its stored render.
 *
 * Not the stored preview, which cannot serve as one at all — a preview is line
 * art on a transparent ground, and a share surface composites that over
 * whatever it picks, white on some and black on others. The card is flattened
 * onto an opaque plate and sells the editor with the space that leaves over.
 *
 * Addressed by the share link, as everything about a document is: the token is
 * the capability, so one route answers every consumer.
 */
export function shareCardUrl(link: string): string {
  return `/api/share/${link}/card.png`;
}

/**
 * The same route as the path pattern `robots.txt` has to allow, built from the
 * one template so the rule cannot come to name a URL the site no longer emits —
 * a mismatch nothing fails on, and that nobody sees until a pasted link unfurls
 * blank.
 */
export const SHARE_CARD_PATH_PATTERN = shareCardUrl('*');
