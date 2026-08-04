import type { ProjectElement } from './project-element';

/**
 * A frozen copy of a custom dependency's circuit, embedded in a project/component
 * save so the saved document is self-contained. Optional and backward compatible:
 * old clients ignore it and fetch the live library component; new clients render
 * from it and never refetch. Its body is the legacy positional `ProjectElement[]`.
 *
 * The summary fields (`numInputs`/`numOutputs`/`labels`/…) are the **frozen**
 * values as placed, duplicated out of the response `dependency` summary (the
 * master's *current* state) so a stale instance renders at its own port count
 * regardless of later master edits (custom-components Invariant A). This
 * `version` vs the live `dependency.version` detects "a newer version exists".
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
   * The frozen embedded circuit (see {@link DependencySnapshot}).
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
