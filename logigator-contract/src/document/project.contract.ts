import * as z from 'zod';
import { pageSchema } from '../page/page.contract';
import {
  circuitDocumentInputSchema,
  circuitDocumentSchema,
  circuitFields,
  documentDependencySchema,
  documentDescriptionSchema,
  documentNameSchema,
  forkAttributionSchema,
  requireSomeField
} from './document.contract';

/** A project in a listing: everything but the document itself. */
export const projectSummarySchema = z.object(circuitFields).loose();

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const projectPageSchema = pageSchema(projectSummarySchema);

export type ProjectPage = z.infer<typeof projectPageSchema>;

/**
 * A project opened for editing. `document` is self-contained — every custom it
 * uses is embedded — so the client needs nothing else to render it.
 * `dependencies` describes those masters as they stand now, which turns a stale
 * embedded snapshot into an offer to update rather than silent divergence.
 */
export const projectResponseSchema = z
  .object({
    ...circuitFields,
    document: circuitDocumentSchema,
    dependencies: z.array(documentDependencySchema),
    /** Fork lineage, root-first; empty for a project that is nobody's fork. */
    attribution: z.array(forkAttributionSchema)
  })
  .loose();

export type ProjectResponse = z.infer<typeof projectResponseSchema>;

/**
 * Creating a project. An absent `document` means an empty board, so a new
 * project can make the row first, while an upload arrives complete without two
 * round trips. `name` is required either way and wins over the document's own:
 * the server writes it back into the stored document, so the column and the
 * document never disagree.
 */
export const createProjectRequestSchema = z.object({
  name: documentNameSchema,
  description: documentDescriptionSchema.optional(),
  public: z.boolean().optional(),
  document: circuitDocumentInputSchema.optional()
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

/**
 * Changing a project's metadata. `regenerateLink` mints a new share token,
 * which is how a share is revoked: every URL under the old one stops resolving.
 */
export const updateProjectRequestSchema = requireSomeField(
  z.object({
    name: documentNameSchema.optional(),
    description: documentDescriptionSchema.optional(),
    public: z.boolean().optional(),
    regenerateLink: z.boolean().optional()
  })
);

export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
