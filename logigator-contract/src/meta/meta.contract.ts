import * as z from 'zod';

/**
 * What the API tells clients about itself. `formatVersion` is the newest
 * circuit-file format version it accepts and stores: a client whose own
 * `CURRENT_FILE_VERSION` is lower is outdated (its writes would be normalized
 * up), one whose version is higher must not upload — such documents are
 * rejected rather than stored.
 */
export const metaResponseSchema = z
  .object({
    formatVersion: z.number().int().positive(),
    /**
     * Which sign-in methods this deployment offers. `local` is always there;
     * `google` depends on credentials being configured, so a client reads it here
     * rather than finding out from a route that answers 501.
     */
    authProviders: z.array(z.enum(['local', 'google']))
  })
  .loose();

export type MetaResponse = z.infer<typeof metaResponseSchema>;
