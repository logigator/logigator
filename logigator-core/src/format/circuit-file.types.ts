/**
 * Versioned native circuit-document format.
 *
 * FROZEN per version. A new version bumps {@link CURRENT_FILE_VERSION}, adds a
 * `CircuitFileV<N>` interface and a migration, and re-points
 * {@link CurrentCircuitFile}; older `CircuitFileV<N>` types stay untouched so
 * shipped documents keep their meaning.
 *
 * The format is self-contained: it embeds a frozen snapshot of every custom
 * component it transitively uses in {@link PersistedCircuitV1.definitions}.
 * Each `CircuitFileV<N>` is the envelope around the shared version payload in
 * `model/persisted-circuit.types.ts`.
 */
import {
  PersistedCircuitV0,
  PersistedCircuitV1
} from '../model/persisted-circuit.types';
import { EmbeddedDependency } from '../model/dependencies';
import { ProjectElement } from '../model/project-element';

export { CURRENT_FILE_VERSION } from './circuit-file-version';
export type CurrentCircuitFile = CircuitFileV1;

// ---- Version 1 (current) ----

export interface CircuitFileV1 extends PersistedCircuitV1 {
  version: 1;
  name: string;
  /**
   * Fork lineage root-first, so a re-import and upload keeps crediting the
   * original creators. Display-side data only: on upload the server re-resolves
   * the immediate parent's id against its own records and derives the authors
   * from there, so a tampered chain can lose attribution, never forge it.
   */
  attribution?: FileForkAttributionV1[];
}

/** One ancestor in {@link CircuitFileV1.attribution} (frozen v1 shape). */
export interface FileForkAttributionV1 {
  projectId: string;
  projectName: string;
  authorName: string;
}

// ---- Version 0 (read-only) ----

export interface CircuitFileV0 extends PersistedCircuitV0 {
  project?: { name?: string; elements?: PersistedCircuitV0['elements'] };
  /**
   * Sub-circuit definitions as a v0 *file* carries them: an `info` header plus
   * the inner positional circuit, with `info.id` the file-local type id the
   * body's custom elements reference. A legacy database row carries
   * `dependencies` instead; a document has one shape or the other.
   */
  components?: LegacyComponentDefinition[];
  /**
   * Dependencies as rows beside the document rather than inside it, each with
   * its embedded `snapshot`. This is the legacy *database* shape, where customs
   * are relations rather than part of the blob; the migration attaches them to
   * the envelope before parsing.
   */
  dependencies?: EmbeddedDependency[];
}

/**
 * One v0 sub-circuit definition: an `info` header (every field optional, since
 * a v0 save may omit any) plus the inner positional circuit.
 */
export interface LegacyComponentDefinition {
  info?: {
    id?: number;
    name?: string;
    description?: string;
    symbol?: string;
    numInputs?: number;
    numOutputs?: number;
    labels?: string[];
  };
  elements?: ProjectElement[];
}
