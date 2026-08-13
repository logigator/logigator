import type { CircuitResource } from './shared';
import {
  type DependencyMapping,
  type DependencySnapshot,
  type ProjectElement
} from '@logigator/core';
import type { ComponentSummary } from './component';

// ---- Entity (list / summary) ----

export interface ProjectSummary extends CircuitResource {
  stargazersCount?: number;
}

// ---- Fork attribution ----

/**
 * One ancestor in a project's fork lineage, resolved by the server from its
 * own fork relations (client-supplied names are never trusted). Chains are
 * ordered **root-first**: the original creation is entry 0, the immediate
 * parent is last.
 */
export interface ForkAttributionEntry {
  projectId: string;
  projectName: string;
  authorName: string;
}

// ---- Dependency (response) ----

export interface ProjectDependency {
  dependency: ComponentSummary;
  model: number;
  /** The frozen embedded circuit as placed. */
  snapshot?: DependencySnapshot;
}

// ---- GET /:projectId response ----

export interface ProjectDetail extends ProjectSummary {
  dependencies: ProjectDependency[];
  elements: ProjectElement[];
  /**
   * `true` when the stored circuit was saved in this editor's format.
   * Absent/`false` means a legacy project: saving here converts it, which can
   * degrade it for the old editor; the load path warns on it.
   */
  newFormat?: boolean;
  /** Fork lineage (root-first), present only when the project is a fork. */
  forkAttribution?: ForkAttributionEntry[];
}

// ---- POST / request ----

export interface CreateProjectRequest {
  name: string;
  description?: string;
  public?: string;
  /**
   * Id of the project this upload is a fork of (a re-import of an exported
   * fork). The server links `forkedFrom` only when the id resolves to a real
   * project; the author is looked up server-side, so a fabricated id cannot
   * credit a false creator.
   */
  forkedFrom?: string;
}

// ---- PUT /:projectId request ----

export interface SaveProjectRequest {
  oldHash: string;
  dependencies: DependencyMapping[];
  elements: ProjectElement[];
  /** Marks the saved circuit as this editor's format (drives the old editor's warning). */
  newFormat: boolean;
}

// ---- PATCH /:projectId request ----

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  public?: boolean;
  updateLink?: boolean;
}
