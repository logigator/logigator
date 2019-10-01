import {ProjectModel} from '../project-model';

export interface ProjectModelResponse extends ProjectModel {
	mappings: ModelDatabaseMap[];
}

export interface ModelDatabaseMap {
	database: number;
	model: number;
}
