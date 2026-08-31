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
 * from it, so neither side encodes the other's rules. Every URL is immutable
 * and safe to cache forever; replacing the image replaces the list.
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
