import * as z from 'zod';
import { pageSchema } from '../page/page.contract';
import {
  circuitDocumentInputSchema,
  circuitDocumentSchema,
  circuitFields,
  componentSymbolSchema,
  documentDependencySchema,
  documentDescriptionSchema,
  documentNameSchema,
  forkAttributionSchema,
  requireSomeField
} from './document.contract';

/**
 * The fields a component has beyond a project's, and a placed instance's whole
 * view of its master: the symbol on its body and the ports around it. The port
 * surface is derived from the document, never sent by a client — a circuit's
 * ports are the plugs placed in it, and a writer's claim about them could
 * disagree, leaving placed instances elsewhere rendering wrong.
 */
const componentFields = {
  ...circuitFields,
  symbol: z.string(),
  numInputs: z.number().int().nonnegative(),
  numOutputs: z.number().int().nonnegative(),
  /** One label per port, every input first, then every output. */
  labels: z.array(z.string())
} as const;

export const componentSummarySchema = z.object(componentFields).loose();

export type ComponentSummary = z.infer<typeof componentSummarySchema>;

export const componentPageSchema = pageSchema(componentSummarySchema);

export type ComponentPage = z.infer<typeof componentPageSchema>;

/** A library component opened for editing; see `projectResponseSchema`. */
export const componentResponseSchema = z
  .object({
    ...componentFields,
    document: circuitDocumentSchema,
    dependencies: z.array(documentDependencySchema),
    attribution: z.array(forkAttributionSchema)
  })
  .loose();

export type ComponentResponse = z.infer<typeof componentResponseSchema>;

/**
 * Creating a library component. `symbol` is the one piece of identity the
 * circuit cannot supply; the port surface is derived from whatever document the
 * row starts with, which for an empty one is no ports at all.
 */
export const createComponentRequestSchema = z.object({
  name: documentNameSchema,
  symbol: componentSymbolSchema,
  description: documentDescriptionSchema.optional(),
  public: z.boolean().optional(),
  document: circuitDocumentInputSchema.optional()
});

export type CreateComponentRequest = z.infer<
  typeof createComponentRequestSchema
>;

/**
 * Changing a component's metadata. Name, symbol and description travel inside
 * every placed snapshot, so changing them bumps `version` and instances frozen
 * at an older one are offered an update. Visibility and the share link are not
 * snapshot content and leave the version alone.
 */
export const updateComponentRequestSchema = requireSomeField(
  z.object({
    name: documentNameSchema.optional(),
    symbol: componentSymbolSchema.optional(),
    description: documentDescriptionSchema.optional(),
    public: z.boolean().optional(),
    regenerateLink: z.boolean().optional()
  })
);

export type UpdateComponentRequest = z.infer<
  typeof updateComponentRequestSchema
>;
