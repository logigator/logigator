import type { CircuitResource } from './shared';
import type { ProjectElement } from './project-element';
import type { DependencyMapping } from './dependencies';

// ---- Entity (list / summary) ----

export interface ComponentSummary extends CircuitResource {
	symbol: string;
	numInputs: number;
	numOutputs: number;
	labels: string[];
	stargazersCount?: number;
}

// ---- Dependency (response) ----

export interface ComponentDependency {
	dependency: ComponentSummary;
	model: number;
}

// ---- GET /:componentId response ----

export interface ComponentDetail extends ComponentSummary {
	dependencies: ComponentDependency[];
	elements: ProjectElement[];
}

// ---- POST / request ----

export interface CreateComponentRequest {
	name: string;
	symbol: string;
	description?: string;
	public?: string;
}

// ---- PUT /:componentId request ----

export interface SaveComponentRequest {
	oldHash: string;
	dependencies: DependencyMapping[];
	elements: ProjectElement[];
	numInputs: number;
	numOutputs: number;
	labels: string[];
}

// ---- PATCH /:componentId request ----

export interface UpdateComponentRequest {
	name?: string;
	description?: string;
	symbol?: string;
	public?: boolean;
	updateLink?: boolean;
}
