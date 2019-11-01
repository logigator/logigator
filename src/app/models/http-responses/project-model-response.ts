import {Element} from '../element';

export interface ProjectModelResponse {
	elements: Element[];
	mappings: ModelDatabaseMap[];
}

export interface ModelDatabaseMap {
	database: number;
	model: number;
}
