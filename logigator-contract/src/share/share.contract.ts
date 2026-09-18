import * as z from 'zod';
import {
  authorSchema,
  circuitDocumentSchema,
  documentDependencySchema,
  forkAttributionSchema
} from '../document/document.contract';
import { componentSummarySchema } from '../document/component.contract';
import { projectSummarySchema } from '../document/project.contract';

/**
 * What a share link resolves to. A discriminated union rather than one shape
 * with optional component fields, so a client that narrowed on `kind` is not
 * still asking whether `numInputs` is there.
 *
 * The link is a capability: the endpoint needs no session and ignores `public`,
 * because holding the URL is the grant — which is why revoking one means
 * minting a new token.
 */
const shareFields = {
  document: circuitDocumentSchema,
  dependencies: z.array(documentDependencySchema),
  /** Fork lineage, root-first, derived from the server's own records. */
  attribution: z.array(forkAttributionSchema),
  author: authorSchema
} as const;

export const shareResponseSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('project'),
      project: projectSummarySchema,
      ...shareFields
    })
    .loose(),
  z
    .object({
      kind: z.literal('component'),
      component: componentSummarySchema,
      ...shareFields
    })
    .loose()
]);

export type ShareResponse = z.infer<typeof shareResponseSchema>;

/**
 * What cloning a share produced, in the caller's account. `dependencies` are
 * the library components the clone brought with it: a document embeds its
 * dependencies' circuits, but a working copy needs its own masters to keep
 * editing them, so the transitive graph is cloned and the copy's snapshots
 * re-pointed at the new ids.
 */
export const cloneResponseSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('project'),
      project: projectSummarySchema,
      dependencies: z.array(componentSummarySchema)
    })
    .loose(),
  z
    .object({
      kind: z.literal('component'),
      component: componentSummarySchema,
      dependencies: z.array(componentSummarySchema)
    })
    .loose()
]);

export type CloneResponse = z.infer<typeof cloneResponseSchema>;
