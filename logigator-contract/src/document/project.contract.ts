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
 * A project opened for editing.
 *
 * `document` is self-contained — every custom component it uses is embedded — so
 * the client needs nothing else to render it. `dependencies` describes those
 * masters as they stand now, which is what turns a stale embedded snapshot into
 * an offer to update rather than a silent divergence.
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
 * Creating a project. `document` is optional and absent means an empty board:
 * the editor's "new project" makes the row first and saves into it, while
 * uploading a local project to the cloud arrives complete and should not need
 * two round trips to land.
 *
 * `name` is required either way and wins over the document's own — a create
 * names the row, and the server writes that name back into the document it
 * stores, so the column and the document never disagree about it.
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
 * which is how a share is revoked — every URL handed out under the old one stops
 * resolving.
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
