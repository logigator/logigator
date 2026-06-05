/**
 * Versioned native file format for save-to-file / load-from-file.
 *
 * These types are FROZEN per version: they intentionally do NOT alias the live
 * `api/models` DTOs (which track the legacy server API and will change). When a
 * new version is introduced, bump {@link CURRENT_FILE_VERSION}, add a new
 * `CircuitFileV<N>` interface + a migration, and re-point
 * {@link CurrentCircuitFile} — older `CircuitFileV<N>` types stay untouched so
 * shipped files keep their meaning.
 *
 * The current format mirrors the editor's in-memory model (named options, wires
 * as start/direction/length) and is self-contained: it embeds a frozen snapshot
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

export const CURRENT_FILE_VERSION = 1;
export type CurrentCircuitFile = CircuitFileV1;

// ---- Version 1 (current, native, self-contained) ----

export interface CircuitFileV1 extends PersistedCircuitV1 {
  version: 1;
  name: string;
}

// ---- Version 0 (legacy old-editor format) ----

export interface CircuitFileV0 extends PersistedCircuitV0 {
  project?: { name?: string; elements?: PersistedCircuitV0['elements'] };
  /** Legacy sub-circuit definitions — preserved historically, ignored on import. */
  components?: unknown[];
  /**
   * Server-transport only: the response `dependencies`, each carrying the
   * additive embedded `snapshot` (R14). Old-editor *files* never have this; the
   * `v0ToV1` migration revives present snapshots into `definitions[]`.
   */
  dependencies?: EmbeddedDependency[];
}
