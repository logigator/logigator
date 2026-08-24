import type { ImageFormat, ImageVariant } from '@logigator/contract';
import { assetUrl, type StorageArea } from './file-storage.service';

/**
 * Which source an asset's variants are derived from. A preview has one render
 * per theme in the same asset directory — the editor produces both in one pass
 * and uploads them together, so the document is the unit, not the theme.
 */
export type ImageSlot = 'light' | 'dark';

export const IMAGE_SLOTS: readonly ImageSlot[] = ['light', 'dark'];

/**
 * One file an asset directory holds: what to encode it as, and what to call it.
 *
 * The matrices below are data rather than encoder calls because two places need
 * them and only one of them encodes: the upload path writes these files, and
 * every response that carries the image lists their URLs without touching the
 * disk.
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
 * twice the device pixel ratio. 1024 is also what the editor renders, so that
 * rung is a transcode rather than a resize.
 *
 * The fallback is PNG, not JPEG. A circuit render is line art on a transparent
 * ground: JPEG cannot carry the transparency and smears one-pixel wires, and
 * measured on a synthetic board a lossy WebP came out *larger* than a lossless
 * one — anti-aliased hairlines are the worst case for a DCT and the best case
 * for a lossless predictor.
 */
export const PREVIEW_VARIANTS: readonly ImageVariantSpec[] =
  IMAGE_SLOTS.flatMap((slot) => matrix([256, 1024], ['webp', 'png'], slot));

/**
 * The variants of one stored asset, as a client reads them.
 *
 * Derived from the matrix rather than from the directory: the files are written
 * together or not at all, so listing them needs no disk access.
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
