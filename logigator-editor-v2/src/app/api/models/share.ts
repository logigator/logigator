import type { ProjectElement } from './project-element';
import type { ProjectDependency } from './project';
import type { ComponentDependency, ComponentSummary } from './component';

// ---- GET /:link response ----

export type ShareDetail = ShareProjectDetail | ShareComponentDetail;

export interface ShareProjectDetail {
  type: 'project';
  id: string;
  name: string;
  description: string;
  createdOn: string;
  lastEdited: string;
  link: string;
  public: boolean;
  previewDark: { publicUrl: string } | null;
  previewLight: { publicUrl: string } | null;
  elementsFile: { hash: string } | null;
  dependencies: ProjectDependency[];
  elements: ProjectElement[];
}

export interface ShareComponentDetail {
  type: 'comp';
  id: string;
  name: string;
  description: string;
  createdOn: string;
  lastEdited: string;
  symbol: string;
  numInputs: number;
  numOutputs: number;
  labels: string[];
  link: string;
  public: boolean;
  previewDark: { publicUrl: string } | null;
  previewLight: { publicUrl: string } | null;
  elementsFile: { hash: string } | null;
  dependencies: ComponentDependency[];
  elements: ProjectElement[];
}

// ---- GET /dependencies/:link response ----

export interface ShareDependenciesResponse {
  dependencies: ComponentSummary[];
}
