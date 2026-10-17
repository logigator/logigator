import type {
  CircuitPreview,
  ImageFormat,
  ImageVariant
} from '@logigator/contract';
import { assetUrl, type StorageArea } from './file-storage.service';

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

/** JPEG's extension is not its format name, and `.jpg` is what the web uses. */
const EXTENSION: Record<ImageFormat, string> = {
  webp: 'webp',
  jpeg: 'jpg',
  png: 'png'
};

function matrix(
  sizes: readonly number[],
  formats: readonly ImageFormat[],
  slot: ImageSlot | null
): ImageVariantSpec[] {
  return sizes.flatMap((size) =>
    formats.map((format) => ({
      file: `${slot ? `${slot}-` : ''}${size}.${EXTENSION[format]}`,
      slot,
      width: size,
      height: size,
      format
    }))
  );
}

/**
 * Avatars: 64 for the places that show one inline, 256 for an account page and
 * for either at twice the device pixel ratio. Photographic, so the fallback is
 * JPEG.
 */
export const AVATAR_VARIANTS: readonly ImageVariantSpec[] = matrix(
  [64, 256],
  ['webp', 'jpeg'],
  null
);

/**
 * Previews: 256 for listing grids, 1024 for a detail view and for the grid at
 * twice the device pixel ratio. 1024 is what the editor renders, so that rung
 * is a transcode rather than a resize.
 *
 * PNG fallback, not JPEG: a circuit render is line art on a transparent ground,
 * which JPEG cannot carry and whose one-pixel wires it smears. Anti-aliased
 * hairlines are the worst case for a DCT — a lossy WebP measured *larger* than
 * a lossless one.
 */
export const PREVIEW_VARIANTS: readonly ImageVariantSpec[] =
  IMAGE_SLOTS.flatMap((slot) => matrix([256, 1024], ['webp', 'png'], slot));

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
