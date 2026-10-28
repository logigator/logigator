import type {
  CircuitPreview,
  ImageFormat,
  ImageVariant
} from '@logigator/contract';
import { assetUrl, type StorageArea } from './storage-layout';

/**
 * Which source an asset's variants are derived from. A preview has one render
 * per theme in the same asset directory — the editor produces both in one pass
 * and uploads them together, so the document is the unit, not the theme.
 */
export type ImageSlot = 'light' | 'dark';

export const IMAGE_SLOTS: readonly ImageSlot[] = ['light', 'dark'];

/**
 * One file an asset directory holds. The matrices below are data, not encoder
 * calls, because the upload path writes these files and every response carrying
 * the image lists their URLs without touching the disk.
 */
export interface ImageVariantSpec {
  /** Name inside the asset directory, extension included. */
  readonly file: string;
  /** The source it is derived from, or `null` where there is only one. */
  readonly slot: ImageSlot | null;
  readonly width: number;
  readonly height: number;
  readonly format: ImageFormat;
}

/** Every variant is WebP; there is no fallback encoding. */
function matrix(
  sizes: readonly number[],
  slot: ImageSlot | null
): ImageVariantSpec[] {
  return sizes.map((size) => ({
    file: `${slot ? `${slot}-` : ''}${size}.webp`,
    slot,
    width: size,
    height: size,
    format: 'webp'
  }));
}

/**
 * Avatars: 64 for the places that show one inline, 256 for an account page and
 * for either at twice the device pixel ratio.
 */
export const AVATAR_VARIANTS: readonly ImageVariantSpec[] = matrix(
  [64, 256],
  null
);

/**
 * Previews: 512 for a listing on a standard-density screen, 1024 for a detail
 * view, the zoom, and a listing at twice the device pixel ratio or more. 1024
 * is what the editor renders, so that rung is a transcode rather than a
 * resize. No listing draws a preview much below 300px, so a 256 rung was never
 * picked; and nothing between the two pays, since a downscale blends the
 * render's one-pixel lines — at 640 it is as many bytes as 1024, at 768 more.
 */
export const PREVIEW_VARIANTS: readonly ImageVariantSpec[] =
  IMAGE_SLOTS.flatMap((slot) => matrix([512, 1024], slot));

/**
 * The file one rung of a matrix was written as, for the one consumer that reads
 * a stored asset instead of pointing a client at it: the share card, which
 * composites the dark render and the WebP avatar into a picture of its own.
 * Looked up rather than spelled out, so a renamed rung breaks at boot.
 */
export function variantFile(
  specs: readonly ImageVariantSpec[],
  rung: Pick<ImageVariantSpec, 'slot' | 'width' | 'format'>
): string {
  const spec = specs.find(
    (candidate) =>
      candidate.slot === rung.slot &&
      candidate.width === rung.width &&
      candidate.format === rung.format
  );

  if (!spec) {
    throw new Error(
      `No ${rung.width}px ${rung.format} variant in this matrix${rung.slot ? ` for the ${rung.slot} slot` : ''}.`
    );
  }
  return spec.file;
}

/**
 * The variants of one stored asset, from the matrix rather than the directory:
 * the files are written together or not at all, so listing needs no disk.
 */
export function variantUrls(
  area: StorageArea,
  id: string,
  specs: readonly ImageVariantSpec[]
): ImageVariant[] {
  return specs.map((spec) => ({
    url: assetUrl(area, id, spec.file),
    width: spec.width,
    height: spec.height,
    format: spec.format
  }));
}

/**
 * A stored preview, split by the render it came from. One asset, two lists: the
 * client picks the theme it is drawing in, and nothing about the request could
 * negotiate that for it.
 */
export function previewUrls(id: string): CircuitPreview {
  return {
    light: variantUrls('preview', id, variantsForSlot('light')),
    dark: variantUrls('preview', id, variantsForSlot('dark'))
  };
}

function variantsForSlot(slot: ImageSlot): ImageVariantSpec[] {
  return PREVIEW_VARIANTS.filter((spec) => spec.slot === slot);
}
