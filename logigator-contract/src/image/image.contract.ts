import { z } from 'zod';

/**
 * The encodings the API derives from an uploaded image.
 *
 * WebP is what almost every client gets. The second format is the fallback for
 * the rest, and which one it is follows the content: JPEG where the source is
 * photographic, PNG where transparency and hard edges have to survive.
 */
export const imageFormatSchema = z.enum(['webp', 'jpeg', 'png']);

export type ImageFormat = z.infer<typeof imageFormatSchema>;

/**
 * One encoding of one image at one size.
 *
 * Every image the API serves is a list of these rather than a single URL: the
 * server owns the ladder it generates, the client picks from it — `<picture>`
 * across the formats, `srcset` across the widths — so neither side has to encode
 * the other's rules. Every URL is immutable and safe to cache forever; replacing
 * the image replaces the whole list with new URLs.
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
