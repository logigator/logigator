import {ProjectModel} from '../project-model';

export interface ProjectModelResponse extends ProjectModel {
	mappings: {
		database: number,
		model: number
	}[];
}
