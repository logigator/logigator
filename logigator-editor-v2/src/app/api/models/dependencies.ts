import type { ProjectElement } from './project-element';

/**
 * Additive (R14): a frozen copy of a custom dependency's circuit, embedded in a
 * project/component save so the saved document is self-contained. Backward
 * compatible — old clients ignore this field and fetch the live library
 * component (rendering always-latest), new clients render straight from it and
 * never refetch. Its body is the legacy positional `ProjectElement[]` (the same
 * wire shape as the document body), folded in per-dependency.
 *
 * The summary fields (`numInputs`/`numOutputs`/`labels`/…) are the **frozen**
 * values as placed — deliberately duplicated out of the response `dependency`
 * summary (which carries the master's *current* state) so a stale instance
 * renders at its own port count regardless of later master edits
 * (custom-components Invariant A). Comparing this `version` to the live
 * `dependency.version` is how "a newer version exists" is detected.
 */
export interface DependencySnapshot {
	/** The master version this copy was taken at. */
	version: number;
	name: string;
	symbol: string;
	description: string;
	numInputs: number;
	numOutputs: number;
	labels: string[];
	elements: ProjectElement[];
}

/** A dependency reference sent when saving a project or component. */
export interface DependencyMapping {
	id: string;
	model: number;
	/**
	 * Additive (R14) — the frozen embedded circuit (see {@link DependencySnapshot}).
	 * Absent for non-custom dependencies and for old write clients.
	 */
	snapshot?: DependencySnapshot;
}

/**
 * The minimal shape the v0 decode reads from a server response's `dependencies`
 * to revive embedded snapshots. Tolerates both the response shape (the master
 * summary nested under `dependency`) and the flat save shape ({@link
 * DependencyMapping}, a top-level `id`), so the encode→decode round-trip needs
 * no reshaping.
 */
export interface EmbeddedDependency {
	id?: string;
	dependency?: { id: string; version?: number };
	model: number;
	snapshot?: DependencySnapshot;
}
