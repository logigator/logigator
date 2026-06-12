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
}

// ---- PATCH /:projectId request ----

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  public?: boolean;
  updateLink?: boolean;
}
