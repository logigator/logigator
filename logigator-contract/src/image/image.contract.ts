import * as z from 'zod';

/** The encodings the API derives from an uploaded image: WebP alone. */
export const imageFormatSchema = z.enum(['webp']);

export type ImageFormat = z.infer<typeof imageFormatSchema>;

/**
 * One encoding of one image at one size. Every image the API serves is a list
 * of these rather than one URL: the server owns the ladder, the client picks
 * from it, so neither side encodes the other's rules. What a URL names never
 * changes, and replacing the image replaces the list. A deleted image's URL
 * stops resolving, and the CDN drops its copy within a day.
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
