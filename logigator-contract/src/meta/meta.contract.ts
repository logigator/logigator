import * as z from 'zod';

/**
 * What the API tells clients about itself. `formatVersion` is the newest
 * document format version it accepts: a client below it is outdated and its
 * writes are normalized up, a client above it must not upload, since such
 * documents are rejected rather than stored.
 */
export const metaResponseSchema = z
  .object({
    formatVersion: z.number().int().positive(),
    /**
     * Which sign-in methods this deployment offers. `local` is always there;
     * `google` depends on configured credentials, so a client reads it here
     * rather than finding out from a route that answers 501.
     */
    authProviders: z.array(z.enum(['local', 'google'])),
    /**
     * Which build is answering: the product version, and the commit and UTC
     * time the bundle was built from. Both are `null` for an unstamped build,
     * which is every build outside a release image.
     */
    build: z
      .object({
        version: z.string(),
        commit: z.string().nullable(),
        date: z.iso.datetime().nullable()
      })
      .loose()
  })
  .loose();

export type MetaResponse = z.infer<typeof metaResponseSchema>;
