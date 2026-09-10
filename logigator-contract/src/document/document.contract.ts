import * as z from 'zod';
import type { CurrentCircuitFile } from '@logigator/core';
import { imageVariantSchema } from '../image/image.contract';

/**
 * The pieces projects and components share. The two are the same thing — a
 * circuit document plus derived metadata — differing only in that a component
 * is placed inside other circuits and so also answers with its port surface.
 */

/** Caps that mirror the columns behind them, so a write fails here, not there. */
export const documentNameSchema = z.string().trim().min(1).max(20);
export const documentDescriptionSchema = z.string().trim().max(2048);
export const componentSymbolSchema = z.string().trim().min(1).max(5);

/**
 * The circuit document a write carries — checked here only for being an object.
 * The format has a versioned, migration-aware validator of its own in
 * `@logigator/core`; a second description in zod would drift. zod's job at this
 * boundary is the envelope.
 *
 * Typed `object` rather than `unknown` because zod derives a key's optionality
 * from whether `undefined` inhabits its type: an `unknown` slot infers as
 * optional, so a write with no document at all would type-check.
 */
export const circuitDocumentInputSchema = z.custom<object>(
  (value) => typeof value === 'object' && value !== null,
  'must be a circuit document'
);

/**
 * The stored document, as a read answers it: always at the current format
 * version, because writes are normalized and reads pass a version guard.
 */
export const circuitDocumentSchema = z.custom<CurrentCircuitFile>(
  (value) => typeof value === 'object' && value !== null,
  'must be a circuit document'
);

/**
 * A circuit's preview: one render per theme, each as the usual variant ladder.
 * Two lists because the client picks by the theme it is drawing in, which no
 * `<picture>` element can negotiate. Both are uploaded and replaced together,
 * so they never disagree about which board they show.
 */
export const circuitPreviewSchema = z
  .object({
    light: z.array(imageVariantSchema),
    dark: z.array(imageVariantSchema)
  })
  .loose();

export type CircuitPreview = z.infer<typeof circuitPreviewSchema>;

/**
 * One ancestor in a document's fork lineage, root-first. The field names are
 * `FileForkAttributionV1`'s, `projectId` for what may be a component included,
 * because the file format froze that spelling.
 *
 * The API answers this from its own records, never from the document: it
 * resolves the client-asserted immediate parent against its rows and derives
 * every author from there. A tampered chain can lose attribution, not forge it.
 */
export const forkAttributionSchema = z
  .object({
    projectId: z.string().uuid(),
    projectName: z.string(),
    authorName: z.string()
  })
  .loose();

export type ForkAttribution = z.infer<typeof forkAttributionSchema>;

/**
 * A library component a document embeds, as the master stands now. A client
 * renders from the document's own frozen snapshot; this exists so `version`
 * against the snapshot's can signal that an update is available. A deleted
 * master is absent from the list and its embedded snapshot keeps working.
 */
export const documentDependencySchema = z
  .object({
    /** The document-local type id this document's instances reference. */
    model: z.number().int(),
    id: z.string().uuid(),
    version: z.number().int(),
    name: z.string(),
    symbol: z.string(),
    description: z.string(),
    numInputs: z.number().int().nonnegative(),
    numOutputs: z.number().int().nonnegative(),
    labels: z.array(z.string())
  })
  .loose();

export type DocumentDependency = z.infer<typeof documentDependencySchema>;

/** Who owns a document, for the endpoints that show somebody else's. */
export const authorSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    avatar: z.array(imageVariantSchema).nullable()
  })
  .loose();

export type Author = z.infer<typeof authorSchema>;

/**
 * What every stored circuit answers with, before the fields only a component
 * has. `version` is the optimistic-concurrency counter a save must present; for
 * a component it doubles as the stamp a placed snapshot compares itself
 * against.
 */
export const circuitFields = {
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  public: z.boolean(),
  /** Share-link token — the capability `GET /share/:link` reads. */
  link: z.string().uuid(),
  version: z.number().int(),
  componentCount: z.number().int().nonnegative(),
  wireCount: z.number().int().nonnegative(),
  preview: circuitPreviewSchema.nullable(),
  createdAt: z.string(),
  lastEditedAt: z.string()
} as const;

/**
 * The body of a save: the document, and the version the client believes it is
 * replacing. A counter the server owns rather than a digest of the stored
 * bytes, so a format bump re-encoding the row does not read as a conflict.
 */
export const saveCircuitRequestSchema = z.object({
  document: circuitDocumentInputSchema,
  version: z.number().int().positive()
});

export type SaveCircuitRequest = z.infer<typeof saveCircuitRequestSchema>;

/** Rejects an update that would change nothing, rather than answering a no-op. */
export function requireSomeField<TSchema extends z.ZodObject>(schema: TSchema) {
  return schema.refine((body) => Object.keys(body).length > 0, {
    message: 'must contain at least one field to update'
  });
}
