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
 * as start/direction/length) rather than the legacy positional wire format.
 */
import { ProjectElement } from '../../api/models/project-element';

export const CURRENT_FILE_VERSION = 1;
export type CurrentCircuitFile = CircuitFileV1;

// ---- Version 1 (current, native) ----

export interface CircuitFileComponentV1 {
	/** Component type id (matches {@link ComponentType}). */
	type: number;
	/** Grid position [x, y]. */
	pos: [number, number];
	/** Option values keyed by the component config's option names. */
	options: Record<string, unknown>;
}

export interface CircuitFileWireV1 {
	/** Start position [x, y] in integer grid units. */
	pos: [number, number];
	/** Wire direction (0 = horizontal, 1 = vertical). */
	direction: number;
	/** Length in grid units. */
	length: number;
}

export interface CircuitFileV1 {
	version: 1;
	name: string;
	components: CircuitFileComponentV1[];
	wires: CircuitFileWireV1[];
}

// ---- Version 0 (legacy) ----
export type CircuitFileElementV0 = ProjectElement;

export interface CircuitFileV0 {
	project?: { name?: string; elements?: CircuitFileElementV0[] };
	/** Legacy sub-circuit definitions — preserved historically, ignored by v2. */
	components?: unknown[];
}
