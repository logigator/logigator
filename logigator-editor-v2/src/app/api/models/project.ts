import type { CircuitResource } from './shared';
import type { ProjectElement } from './project-element';
import type { DependencyMapping, DependencySnapshot } from './dependencies';
import type { ComponentSummary } from './component';

// ---- Entity (list / summary) ----

export interface ProjectSummary extends CircuitResource {
  stargazersCount?: number;
}

// ---- Dependency (response) ----

export interface ProjectDependency {
  dependency: ComponentSummary;
  model: number;
  /** Additive (R14) — the frozen embedded circuit as placed. */
  snapshot?: DependencySnapshot;
}

// ---- GET /:projectId response ----

export interface ProjectDetail extends ProjectSummary {
  dependencies: ProjectDependency[];
  elements: ProjectElement[];
  /**
   * Additive — `true` when the stored circuit predates this editor's format (no
   * embedded snapshots, no negation). Saving here converts it, which can degrade
   * it for the old editor; the load path warns on it.
   */
  legacyFormat?: boolean;
}

// ---- POST / request ----

export interface CreateProjectRequest {
  name: string;
  description?: string;
  public?: string;
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
