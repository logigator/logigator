import * as z from 'zod';

/**
 * The encodings the API derives from an uploaded image. WebP is what almost
 * every client gets; the fallback follows the content — JPEG for photographic
 * sources, PNG where transparency and hard edges have to survive.
 */
export const imageFormatSchema = z.enum(['webp', 'jpeg', 'png']);

export type ImageFormat = z.infer<typeof imageFormatSchema>;

/**
 * One encoding of one image at one size. Every image the API serves is a list
 * of these rather than one URL: the server owns the ladder, the client picks
 * from it, so neither side encodes the other's rules. What a URL names never
 * changes, and replacing the image replaces the list. A deleted image's URL
 * stops resolving and is purged from the CDN; a browser's copy cannot be, so
 * browsers keep an avatar an hour and a preview a year.
 */
export const imageVariantSchema = z
  .object({
    url: z.string(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    format: imageFormatSchema
  })
  .loose();

export type ImageVariant = z.infer<typeof imageVariantSchema>;
