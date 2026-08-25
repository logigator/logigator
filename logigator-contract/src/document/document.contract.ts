import { z } from 'zod';
import type { CurrentCircuitFile } from '@logigator/core';
import { imageVariantSchema } from '../image/image.contract';

/**
 * The pieces projects and components share. The two are the same thing stored
 * twice — a circuit document plus derived metadata — differing only in that a
 * component is placed inside other circuits and therefore also answers with the
 * port surface a placed instance needs.
 */

/** Caps that mirror the columns behind them, so a write fails here, not there. */
export const documentNameSchema = z.string().trim().min(1).max(20);
export const documentDescriptionSchema = z.string().trim().max(2048);
export const componentSymbolSchema = z.string().trim().min(1).max(5);

/**
 * The circuit document a write carries — checked here only for being an object.
 *
 * Deliberately not modelled in zod. The document format has a validator of its
 * own in `@logigator/core` (versioned, migration-aware, and shared with the
 * editor's file path), and a second description of it in zod would be a second
 * source of truth that drifts. zod's job at this boundary is the envelope; the
 * server hands what is inside it to `parseCircuitDocument`, which is also what
 * decides whether a version this copy predates can be read at all.
 *
 * Typed `object` rather than `unknown` for a mechanical reason worth knowing:
 * zod derives a key's optionality from whether `undefined` inhabits its type, so
 * an `unknown` slot infers as an *optional* property and a write with no
 * document at all would type-check.
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
 *
 * Two lists rather than one, because the client picks by the theme it is drawing
 * in — not by anything a `<picture>` element can negotiate. They are one stored
 * asset all the same: the editor renders both in a single pass and uploads them
 * together, so they are replaced together and never disagree about which board
 * they show.
 */
export const circuitPreviewSchema = z
  .object({
    light: z.array(imageVariantSchema),
    dark: z.array(imageVariantSchema)
  })
  .loose();

export type CircuitPreview = z.infer<typeof circuitPreviewSchema>;

/**
 * One ancestor in a document's fork lineage, root-first.
 *
 * The field names are `FileForkAttributionV1`'s, deliberately — including
 * `projectId` for what may be a component. The exported file format froze that
 * spelling, and a second spelling for the identical concept would buy nothing
 * but a mapping step in every client that re-exports a cloud document.
 *
 * The API answers this from its own records, never from the document: a client
 * asserts a lineage on upload, the server resolves the immediate parent against
 * its rows and derives every author from there. A tampered chain can lose
 * attribution; it cannot forge it.
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
 * A library component a document embeds, as it stands *now*.
 *
 * The document itself carries a frozen snapshot of every dependency, so this is
 * not what a client renders from — it is what tells the client the master has
 * moved on: `version` against the snapshot's own is the whole "an update is
 * available" signal. A dependency whose master has since been deleted simply is
 * not in this list, and the embedded snapshot keeps working.
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
 * has. `version` is the optimistic-concurrency counter a save must present, and
 * for a component it doubles as the stamp a placed snapshot compares itself
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
 * replacing.
 *
 * The counter replaces the legacy MD5 `oldHash` handshake. Same purpose, but a
 * number the server owns rather than a digest of the bytes it happened to
 * store — so it survives the document being re-encoded underneath a client
 * (which a format bump does to every row) without reading as a conflict.
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
