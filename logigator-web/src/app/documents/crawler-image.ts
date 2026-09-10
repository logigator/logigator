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
