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
 * of every custom component it transitively uses in {@link CircuitFileV2.definitions}
 * via the universal codec (`persistence/snapshots.ts`).
 */
import { ProjectElement } from '../../api/models/project-element';
import {
	SerializedComponentBody,
	SerializedWireBody,
	SnapshotDefinition
} from '../serialized-circuit';

export const CURRENT_FILE_VERSION = 2;
export type CurrentCircuitFile = CircuitFileV2;

// ---- Version 2 (current, native, self-contained) ----

export interface CircuitFileV2 {
	version: 2;
	name: string;
	/** The main circuit. Custom `type`s are file-local ids defined in {@link definitions}. */
	components: SerializedComponentBody[];
	wires: SerializedWireBody[];
	/** Frozen snapshots of every custom this file transitively uses (recursive). */
	definitions: SnapshotDefinition[];
}

// ---- Version 0 (legacy old-editor format) ----
export type CircuitFileElementV0 = ProjectElement;

export interface CircuitFileV0 {
	project?: { name?: string; elements?: CircuitFileElementV0[] };
	/** Legacy sub-circuit definitions — preserved historically, ignored on import. */
	components?: unknown[];
}
