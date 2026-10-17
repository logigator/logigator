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
    authProviders: z.array(z.enum(['local', 'google']))
  })
  .loose();

export type MetaResponse = z.infer<typeof metaResponseSchema>;
