import type { ProjectElement } from './project-element';

/**
 * A frozen copy of a custom dependency's circuit as the v0 transport embeds it,
 * body in the positional `ProjectElement[]` encoding.
 *
 * The summary fields are frozen as placed, so a stale instance renders at its
 * own port count regardless of later master edits. This `version` against the
 * live `dependency.version` is what detects that a newer version exists.
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
  /** Absent for non-custom dependencies and for clients that embed nothing. */
  snapshot?: DependencySnapshot;
}

/**
 * The minimal shape the v0 decode reads from a `dependencies` array to revive
 * embedded snapshots. Tolerates both the response shape (master summary nested
 * under `dependency`) and the flat save shape, so a round-trip needs no
 * reshaping.
 */
export interface EmbeddedDependency {
  id?: string;
  dependency?: { id: string; version?: number };
  model: number;
  snapshot?: DependencySnapshot;
}
