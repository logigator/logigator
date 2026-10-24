import * as z from 'zod';
import { pageSchema } from '../page/page.contract';
import {
  circuitDocumentInputSchema,
  circuitDocumentSchema,
  circuitFields,
  documentDependencySchema,
  documentDescriptionSchema,
  documentNameSchema,
  documentVisibilitySchema,
  forkAttributionSchema,
  requireSomeField
} from './document.contract';
import { ownerTextFields } from './document-text.contract';

/** A project in a listing: everything but the document itself. */
export const projectSummarySchema = z.object(circuitFields).loose();

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

/**
 * A project in its owner's own listing, with the languages of its texts and
 * the versions its author wrote in other languages.
 */
export const ownedProjectSummarySchema =
  projectSummarySchema.extend(ownerTextFields);

export type OwnedProjectSummary = z.infer<typeof ownedProjectSummarySchema>;

export const projectPageSchema = pageSchema(ownedProjectSummarySchema);

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
    ...ownerTextFields,
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
 *
 * `visibility` absent means `unlisted` — a link that resolves, in no listing —
 * which is what a created-in-a-hurry document should be. The editor's create
 * dialogs send a state of their own, publishing by default.
 */
export const createProjectRequestSchema = z.object({
  name: documentNameSchema,
  description: documentDescriptionSchema.optional(),
  visibility: documentVisibilitySchema.optional(),
  document: circuitDocumentInputSchema.optional()
});

export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

/**
 * Changing a project's metadata. `regenerateLink` mints a new share token,
 * which is how a share is revoked: every URL under the old one stops resolving.
 * It is refused while the document is public — the page's own address *is* that
 * link — so a published document is moved back to `unlisted` first.
 *
 * `visibility` never touches the link. It is the document's address rather than
 * a grant, so `private → unlisted` restores the same URL and a bookmark or a
 * link somebody already copied keeps working; hiding a document revokes nothing.
 */
export const updateProjectRequestSchema = requireSomeField(
  z.object({
    name: documentNameSchema.optional(),
    description: documentDescriptionSchema.optional(),
    visibility: documentVisibilitySchema.optional(),
    regenerateLink: z.boolean().optional()
  })
);

export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
