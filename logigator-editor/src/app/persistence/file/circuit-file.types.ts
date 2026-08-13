/**
 * Versioned native file format for save-to-file / load-from-file.
 *
 * These types are FROZEN per version: they intentionally do NOT alias the live
 * `api/models` DTOs (which track the legacy server API and will change). When a
 * new version is introduced, bump {@link CURRENT_FILE_VERSION} in
 * `@logigator/core` (the server normalizes documents to the same constant), add
 * a new `CircuitFileV<N>` interface + a migration, and re-point
 * {@link CurrentCircuitFile} — older `CircuitFileV<N>` types stay untouched so
 * shipped files keep their meaning.
 *
 * The current format mirrors the editor's in-memory model (named options; wires
 * chain-encoded as `"x,y:e5s3;…"`, see `wire-chain.codec.ts`) and is
 * self-contained: it embeds a frozen snapshot
 * of every custom component it transitively uses in {@link PersistedCircuitV1.definitions}
 * via the universal codec (`persistence/snapshots.ts`).
 *
 * Each `CircuitFileV<N>` is the file-target envelope around the shared
 * version payload in `persistence/persisted-circuit.types.ts`.
 */
import {
  PersistedCircuitV0,
  PersistedCircuitV1
} from '../persisted-circuit.types';
import { EmbeddedDependency } from '../../api/models/dependencies';
import { ProjectElement } from '../../api/models/project-element';

export { CURRENT_FILE_VERSION } from '@logigator/core';
export type CurrentCircuitFile = CircuitFileV1;

// ---- Version 1 (current, native, self-contained) ----

export interface CircuitFileV1 extends PersistedCircuitV1 {
  version: 1;
  name: string;
  /**
   * Fork lineage of the exported project, root-first (the original creation
   * is entry 0, the immediate parent is last). Written when a fork of a cloud
   * project is exported so a later re-import + upload keeps crediting the
   * original creators. Display-side data only: on upload the server re-resolves
   * the immediate parent's id against its own records and derives the real
   * authors from there — a tampered chain can lose attribution, never forge it.
   */
  attribution?: FileForkAttributionV1[];
}

/** One ancestor in {@link CircuitFileV1.attribution} (frozen v1 shape). */
export interface FileForkAttributionV1 {
  projectId: string;
  projectName: string;
  authorName: string;
}

// ---- Version 0 (legacy old-editor format) ----

export interface CircuitFileV0 extends PersistedCircuitV0 {
  project?: { name?: string; elements?: PersistedCircuitV0['elements'] };
  /**
   * Old-editor *file* sub-circuit definitions: each pairs a component `info`
   * header with its inner positional circuit. The `v0ToV1` migration revives
   * these into `definitions[]` (`info.id` is the file-local type id the body's
   * custom elements reference). The server transport uses `dependencies`
   * instead; a given document carries one shape or the other.
   */
  components?: LegacyComponentDefinition[];
  /**
   * Server-transport only: the response `dependencies`, each carrying the
   * additive embedded `snapshot`. Old-editor *files* never have this; the
   * `v0ToV1` migration revives present snapshots into `definitions[]`.
   */
  dependencies?: EmbeddedDependency[];
}

/**
 * One old-editor sub-circuit definition as written to a local file: an `info`
 * header (all fields optional — legacy saves may omit any) plus the inner
 * circuit as a positional `ProjectElement[]`. `info.id` is the custom-range
 * type id the outer body's instances reference.
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
